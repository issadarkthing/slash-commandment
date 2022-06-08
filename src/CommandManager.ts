import { Client, CommandInteraction, Interaction } from "discord.js";
import chalk from "chalk";
import util from "util";
import fs from "fs"
import path from "path";
import { Command } from "./Command";
import { oneLine } from "common-tags";
import { Routes } from "discord-api-types/v9";
import { REST } from "@discordjs/rest";
//@ts-ignore
import Table from "table-layout";
import { CommandError } from "./Error";
import { CooldownManager, TimeLeft } from "./CooldownManager";

const readdir = util.promisify(fs.readdir);

export type Exec = Command["exec"];

interface CommandLog {
  name: string;
  timeTaken: number;
}

interface CommandManagerOptions {
  client: Client;
  devGuildID: string;
  isDev?: boolean;
}

export class CommandManager {
  verbose = true;
  readonly client: Client;
  readonly devGuildID: string;
  readonly isDev: boolean;
  commands = new Map<string, Command>();
  private cooldown = new CooldownManager();
  private commandRegisterLog: CommandLog[] = [];
  private commandOnCooldownHandler?: (
    i: CommandInteraction,
    command: Command,
    timeLeft: TimeLeft,
  ) => void;
  private commandErrorHandler?: (i: CommandInteraction, err: CommandError) => void;

  constructor(options: CommandManagerOptions) {
    this.client = options.client;
    this.devGuildID = options.devGuildID;
    this.isDev = options.isDev || true;
  }

  private log(...values: any[]) {
    this.verbose && console.log(...values);
  }

  async registerCommands(dir: string) {

    this.log(`=== ${chalk.blue("Registering command(s)")} ===`);

    const files = await readdir(dir);
    const initial = performance.now();

    const rest = new REST({ version: '9' }).setToken(this.client.token!);


    const commands: unknown[] = [];

    for (const file of files) {
      // skip .d.ts files
      if (file.endsWith(".d.ts")) continue;

      const initial = performance.now();
      const filePath = path.join(dir, file);
      // eslint-disable-next-line
      const cmdFile = require(filePath);
      const command: Command = new cmdFile.default();
      const now = performance.now();
      const timeTaken = now - initial;

      if (command.disable) continue;


      if (commands) {

        commands.push(command.toJSON());

        this.commandRegisterLog.push({
          name: command.name,
          timeTaken,
        });

        this.commands.set(command.name, command);
      }
    }

    const commandType = this.isDev ? "application" : "global";

    console.log(`Started refreshing ${commandType} (/) commands.`);

    const discordCmdManager = this.isDev ? 
      Routes.applicationGuildCommands : Routes.applicationCommands;

    await rest.put(
      discordCmdManager(this.client.user!.id, this.devGuildID),
      { body: commands },
    );

    console.log(`Successfully reloaded ${commandType} (/) commands.`);

    const now = performance.now();
    const timeTaken = (now - initial).toFixed(4);

    this.commandRegisterLog.sort((a, b) => b.timeTaken - a.timeTaken);

    const rows: Record<string, string>[] = [];

    for (const log of this.commandRegisterLog) {
      const timeTaken = log.timeTaken.toFixed(4);
      const timeTakenFmt = chalk.yellow(`[${timeTaken} ms]`);

      rows.push({
        timeTakenFmt,
        name: log.name,
      });
    }

    this.log((new Table(rows)).toString());

    const commandCount = this.commandRegisterLog.length;
    this.log(
      oneLine`Loading ${chalk.green(commandCount)} command(s) took
      ${chalk.yellow(timeTaken, "ms")}`
    );
  }

  handleCommandError(fn: (i: CommandInteraction, err: CommandError) => void) {
    this.commandErrorHandler = fn;
  }

  handleCommandOnCooldown(fn: (i: CommandInteraction, command: Command, timeLeft: TimeLeft) => void) {
    this.commandOnCooldownHandler = fn;
  }

  async handleInteraction(i: Interaction) {

    if (!i.isCommand()) return;

    const command = this.commands.get(i.commandName)!;

    if (command.cooldown) {

      const authorID = i.user.id;
      const isCooldown = await this.cooldown.isOnCooldown(command.name, authorID);

      if (isCooldown) {

        const timeLeft = await this.cooldown.getTimeLeft(command.name, authorID);


        if (this.commandOnCooldownHandler) {
          this.commandOnCooldownHandler(i, command, timeLeft);
        } else {
          const { hours, minutes, seconds } = timeLeft;
          i.reply(`This command is on cooldown for ${hours}h ${minutes}m ${seconds}s`);
        }

        this.log(
          `${chalk.blue(command.name)} command is on cooldown`
        );
        return;

      }

      const commandUsage = await this.cooldown.getCommandUsage(command.name, authorID) + 1;

      if (commandUsage >= command.usageBeforeCooldown) {
        await this.cooldown.setCooldown(command.name, authorID, command.cooldown);
        await this.cooldown.resetComandUsage(command.name, authorID);
      } else {
        await this.cooldown.incCommandUsage(command.name, authorID);
      }

    }

    try {

      if (command) {

        for (const preExec of command.preExec) {
          await preExec(i);
        }

        await command.exec(i);

        for (const postExec of command.postExec) {
          await postExec(i);
        }
      }

    } catch (e) {

      if (e instanceof CommandError && this.commandErrorHandler) {
        this.commandErrorHandler(i, e);
      } else {
        console.error(e);
      }
    }
  }
}
