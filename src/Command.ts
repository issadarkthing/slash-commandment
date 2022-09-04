import { DurationLikeObject } from "luxon";
import { CommandInteraction, SlashCommandBuilder } from "discord.js";
import { Exec } from "./CommandManager";

export interface Duration extends DurationLikeObject {};

export abstract class Command extends SlashCommandBuilder {
  disable = false;
  abstract name: string;
  abstract description: string;
  preExec: Exec[] = [];
  postExec: Exec[] = [];
  abstract exec(i: CommandInteraction): Promise<void>;
  
  async commandOptions(): Promise<void> {};

  usageBeforeCooldown = 1;
  cooldown?: Duration;
}
