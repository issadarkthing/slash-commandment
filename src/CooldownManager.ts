import { DateTime, DurationLikeObject } from "luxon";
import Josh from "@joshdb/core";
//@ts-ignore
import provider from "@joshdb/sqlite";

export interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

export class CooldownManager {
  private db: Josh<Date>;
  private usage: Josh<number>;

  constructor() {
    this.db = new Josh({
      name: "cooldowns",
      provider,
    });

    this.usage = new Josh({
      name: "command_usages",
      provider,
    });
  }

  private isPassed(dt: DateTime | Date) {

    if (dt instanceof Date) {
      dt = DateTime.fromJSDate(dt);
    }


    return dt.diffNow(["seconds"]).seconds < 0;
  }

  private id(commandID: string, userID: string) {
    return `${commandID}-${userID}`;
  }

  async setCooldown(commandID: string, userID: string, duration: DurationLikeObject) {
    const time = DateTime.now().plus(duration);
    await this.db.set(this.id(commandID, userID), time.toJSDate());
  }

  async resetCooldown(commandID: string, userID: string) {
    await this.db.set(this.id(commandID, userID), new Date(2000));
  }

  async incCommandUsage(commandID: string, userID: string) {
    const id = this.id(commandID, userID);
    const count = await this.getCommandUsage(commandID, userID);
    await this.usage.set(id, count + 1);
  }

  async decCommandUsage(commandID: string, userID: string) {
    const id = this.id(commandID, userID);
    const count = await this.getCommandUsage(commandID, userID);
    const usageCount = count > 0 ? count - 1 : 0;
    await this.usage.set(id, usageCount);
  }

  getCommandUsage(commandID: string, userID: string) {
    const id = this.id(commandID, userID);
    return this.usage.ensure(id, 0);
  }

  async resetComandUsage(commandID: string, userID: string) {
    const id = this.id(commandID, userID);
    await this.usage.set(id, 0);
  }

  async isOnCooldown(commandID: string, userID: string) {

    const lastSet = await this.db.get(this.id(commandID, userID));

    if (!lastSet) return false;

    return !this.isPassed(lastSet);
  }

  async getTimeLeft(commandID: string, userID: string): 
  Promise<TimeLeft> {

    const lastSet = await this.db.get(this.id(commandID, userID));

    if (!lastSet) return { hours: 0, minutes: 0, seconds: 0 };

    const dt = DateTime.fromJSDate(lastSet);

    if (this.isPassed(dt)) return { hours: 0, minutes: 0, seconds: 0 };

    const { 
      hours, 
      minutes, 
      seconds,
    } = dt.diffNow(["hours", "minutes", "seconds", "milliseconds"]);

    return { hours, minutes, seconds };
  }
}
