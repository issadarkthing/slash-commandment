import { CommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";

export abstract class Command extends SlashCommandBuilder {
  disable = false;
  abstract name: string;
  abstract description: string;
  abstract exec(i: CommandInteraction): Promise<void>;
}
