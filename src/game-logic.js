
import config from './game-config';
import { ErrorMessage } from './utility';

class Cell {
  constructor(x, y, value) {
    this.x = x;
    this.y = y;
    this.value = value;
  }
}

class Grid {
  constructor(data) {
    this.cells = data.map((row, x) => row.map((cell, y) => {
      return new Cell(x, y, cell);
    }));
  }

  inBound(x, y) {
    return x >= 0 && y >= 0 && x < this.cells.length && y < this.cells[x].length;
  }

  toJSON() {
    return this.cells.map(row => row.map(cell => cell.value));
  }
}

export class GameState {
  constructor({ score, numBuilt, numStars, numBombs, grid, command }) {
    this.score = score;
    this.numBuilt = numBuilt;
    this.numStars = numStars;
    this.numBombs = numBombs;
    this.grid = new Grid(grid);
    this.command = command;
  }

  checkReaction(x, y, targetType) {
    if (targetType === 9) return null;
    const vectors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const queue = [[x, y]];
    for (let head = 0; head < queue.length; ++head) {
      const [x, y] = queue[head];
      for (const [dx, dy] of vectors) {
        const x2 = x + dx, y2 = y + dy;
        if (!queue.some(([x, y]) => x === x2 && y === y2) &&
            this.grid.inBound(x2, y2) &&
            this.grid.cells[x2][y2].value === targetType) {
          queue.push([x2, y2]);
        }
      }
    }
    if (queue.length >= config.reaction.minCount) {
      return {
        type: {
          before: targetType,
          after: targetType + 1
        },
        cells: queue
      };
    } else {
      return null;
    }
  }

  putStructure(target, type) {
    target.value = type;
    this.score += config.scoring.build[type];
    let phase = [];
    while (true) {
      let info = this.checkReaction(target.x, target.y, target.value);
      if (!info) break;
      phase.push(info);
      for (let [x, y] of info.cells) {
        this.grid.cells[x][y].value = null;
      }
      target.value = info.type.after;
      this.score += config.scoring.build[info.type.after];
    }
    return { phase };
  }

  build(x, y, type) {
    let target = this.grid.cells[x][y];
    if (target.value) {
      throw new ErrorMessage("You can't put structures here, since it's not empty.");
    }
    this.command = `BUILD ${x + 1} ${y + 1}`;
    ++this.numBuilt;
    return this.putStructure(target, type);
  }

  getStarType(x, y) {
    for (let type = 9; type > 1; --type) {
      if (this.checkReaction(x, y, type)) return type;
    }
    return 1;
  }

  putStar(x, y) {
    if (!this.numStars) {
      throw new ErrorMessage("You don't have any stars left.");
    }
    let target = this.grid.cells[x][y];
    if (target.value) {
      throw new ErrorMessage("You can't put stars here, since it's not empty.");
    }
    this.command = `STAR ${x + 1} ${y + 1}`;
    --this.numStars;
    const type = this.getStarType(x, y);
    return this.putStructure(target, type);
  }

  putBomb(x, y) {
    if (!this.numBombs) {
      throw new ErrorMessage("You don't have any bombers left.");
    }
    let target = this.grid.cells[x][y];
    if (!target.value) {
      throw new ErrorMessage("You can't put bombers here, since it's empty.");
    }
    this.command = `BOMBER ${x + 1} ${y + 1}`;
    --this.numBombs;
    const { bomb: { ratio }, build } = config.scoring;
    const type = target.value;
    this.score -= ratio * build[type];
    target.value = null;
    return { type };
  }

  toJSON() {
    return {
      score: this.score,
      numBuilt: this.numBuilt,
      numStars: this.numStars,
      numBombs: this.numBombs,
      grid: this.grid.toJSON(),
      command: this.command
    };
  }

  clone() {
    return new GameState(this.toJSON());
  }
}
