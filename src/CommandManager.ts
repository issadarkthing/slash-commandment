import { Client, Interaction, Guild } from "discord.js";
import chalk from "chalk";
import util from "util";
import fs from "fs"
import path from "path";
import { Command } from "./Command";
import { oneLine } from "common-tags";
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
  private commandRegisterLog: CommandLog[] = [];
  private commands = new Map<string, Command>();

  constructor(client: Client, devGuildID: string) {
    this.client = client;
    this.devGuildID = devGuildID;
  }

  private log(...values: any[]) {
    this.verbose && console.log(...values);
  }

  async registerCommands(dir: string) {

    this.log(`=== ${chalk.blue("Registering command(s)")} ===`);

    const files = await readdir(dir);
    const initial = performance.now();

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

      await this.client.guilds.fetch();
      const devGuild = this.client.guilds.cache.get(this.devGuildID);

      const commands = devGuild?.commands || this.client.application?.commands;

      if (commands) {

        commands.create({
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
