import { Client, Interaction } from "discord.js";
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

const readdir = util.promisify(fs.readdir);

interface CommandLog {
  name: string;
  timeTaken: number;
}

export class CommandManager {
  verbose = true;
  readonly client: Client;
  readonly devGuildID: string;
  readonly isDev: boolean;
  private commandRegisterLog: CommandLog[] = [];
  private commands = new Map<string, Command>();

  constructor(client: Client, devGuildID: string, isDev = true) {
    this.client = client;
    this.devGuildID = devGuildID;
    this.isDev = isDev;
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

        commands.push({
          name: command.name,
          description: command.description,
        })

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

  async handleInteraction(i: Interaction) {

    if (!i.isCommand()) return;

    const command = this.commands.get(i.commandName);

    command && await command.exec(i);
  }
}
