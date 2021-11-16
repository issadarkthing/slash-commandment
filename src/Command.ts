import { CommandInteraction } from "discord.js";


export abstract class Command {
  abstract name: string;
  abstract description: string;
  abstract exec(i: CommandInteraction): Promise<void> | void;
  disable = false;
}
