import { Injectable } from "@nestjs/common";
import * as _ from "lodash";
import { Sequelize } from "sequelize-typescript";

/**
 * A service that is only used in the REPL. It gives access to some things that are handy in a REPL
 * environment, like the lodash libs, and an easy reference to every DB model class.
 */
@Injectable()
export class REPL {
  constructor(readonly sequelize: Sequelize) {}

  /**
   * Give access to all of lodash.
   */
  get _() {
    return _;
  }

  get models() {
    return this.sequelize.models;
  }
}
