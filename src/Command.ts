import { DurationLikeObject } from "luxon";
import { CommandInteraction } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { Exec } from "./CommandManager";

export interface Duration extends DurationLikeObject {};

export abstract class Command extends SlashCommandBuilder {
  disable = false;
  abstract name: string;
  abstract description: string;
  preExec: Exec[] = [];
  postExec: Exec[] = [];
  abstract exec(i: CommandInteraction): Promise<void>;

  usageBeforeCooldown = 1;
  cooldown?: Duration;
}
