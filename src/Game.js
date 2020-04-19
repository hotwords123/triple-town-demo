import React from 'react';
import './Game.css';

import { makeClassName, ErrorMessage, copyText, saveTextAsFile } from "./utility";
import parseInputFile from "./input-parser";
import { GameState } from "./game-logic";
import Toast from './Toast';

class BoardCell extends React.Component {
  render() {
    const cell = this.props.cell;
    const { x, y, value, isPreview, reaction } = cell;
    const classNames = [];

    classNames.push(value ? value : 'empty');
    if (isPreview) classNames.push('preview');
    if (reaction) classNames.push('reaction');

    return (
      <div
        className={makeClassName('board-cell', classNames.map(a => 'board-cell-' + a))}
        onMouseOver={() => this.props.onHover({ x, y })}
        onMouseOut={() => this.props.onHover(null)}
        onMouseUp={(evt) => this.props.onClick(cell, evt)}
        onContextMenu={(evt) => evt.preventDefault()}
      >
        <span>{value}</span>
      </div>
    );
  }
}

class Board extends React.Component {
  renderCell(cell) {
    const { x, y } = cell;

    return (
      <BoardCell
        key={`${x},${y}`}
        cell={cell}
        onHover={this.props.onHover}
        onClick={this.props.onClick}
      />
    );
  }

  renderRow(row, x) {
    const boardCells = row.map(cell => this.renderCell(cell));
    return (
      <div className="board-row" key={x}>
        {boardCells}
      </div>
    );
  }

  render() {
    const boardRows = this.props.grid.cells.map((row, x) => this.renderRow(row, x));
    return (
      <div>
        {boardRows}
      </div>
    );
  }
}

class ToolButton extends React.Component {
  render() {
    const { selected, title, amount } = this.props;
    const classes = {
      active: selected === 0,
      'active-second': selected === 1,
      disabled: amount === 0
    };

    return (
      <div
        className={makeClassName("game-tool-btn", classes)}
        onMouseUp={(evt) => this.props.onClick(evt)}
        onContextMenu={(evt) => evt.preventDefault()}
      >
        <strong className="title">{title}</strong>
        <span className="amount">{amount}</span>
      </div>
    );
  }
}

class Game extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false,
      toasts: [],
      width: 0,
      height: 0,
      buildQueue: [],
      history: [],
      stepNumber: 0,
      selectedTools: ['build', 'star'],
      hover: null,
      hoverType: ''
    };
    this.fileInput = React.createRef();
    this.commandInput = React.createRef();
    this.handleHover = this.handleHover.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleHistoryHover = this.handleHistoryHover.bind(this);
    this.handleCommandExec = this.handleCommandExec.bind(this);
    this.handleCommandClear = this.handleCommandClear.bind(this);
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown, false);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown, false);
  }

  /**
   * @returns {GameState}
   */
  get currentStep() {
    return this.state.history[this.state.stepNumber];
  }

  handleFileSelect() {
    let files = this.fileInput.current.files;
    if (files.length === 0) {
      Toast("No input file was selected.");
      return;
    }
    let reader = new FileReader();
    reader.readAsText(files[0]);
    reader.onload = () => {
      let result;
      try {
        result = parseInputFile(reader.result);
      } catch (err) {
        Toast("Failed to parse input file.");
        console.error(err);
        return;
      }
      console.log(result);
      this.loadedFilename = files[0].name;
      this.loadGame(result);
    };
    reader.onerror = () => {
      Toast("Failed to read input file.");
    };
  }

  loadGame({ width, height, numStars, numBombs, grid, queue }) {
    const gameState = new GameState({
      score: 0, numBuilt: 0,
      numStars, numBombs, grid,
      command: null
    });

    this.setState({
      loaded: true,
      width, height,
      buildQueue: queue,
      history: [gameState],
      stepNumber: 0
    });
  }

  handleToolSelect(tool, evt) {
    let index = evt.button === 0 ? 0 : 1;
    let list = this.state.selectedTools.slice(0);
    if (list[1 - index] === tool) {
      list.reverse();
    } else {
      list[index] = tool;
    }
    this.setState({ selectedTools: list });
  }

  exportCommands() {
    return this.state.history.slice(1, this.state.stepNumber + 1).map(state => state.command);
  }

  handleKeyDown(evt) {
    if (!this.state.loaded) return;
    if (evt.ctrlKey && evt.which === 90) { // Ctrl+Z: undo
      const stepNumber = this.state.stepNumber;
      if (stepNumber > 0) {
        this.setState({ stepNumber: stepNumber - 1 });
      } else {
        Toast("No operation can be undone.");
      }
    }
    if (evt.ctrlKey && evt.which === 89) { // Ctrl+Y: redo
      const stepNumber = this.state.stepNumber;
      if (stepNumber < this.state.history.length - 1) {
        this.setState({ stepNumber: stepNumber + 1 });
      } else {
        Toast("No operation can be redone.");
      }
    }
    if (evt.ctrlKey && evt.which === 67) { // Ctrl+C: copy
      evt.preventDefault();
      if (this.state.stepNumber > 0) {
        copyText(this.exportCommands().concat('').join('\n'));
        Toast("Commands have been copied to clipboard.");
      } else {
        Toast("No command can be copied.");
      }
    }
    if (evt.ctrlKey && evt.which === 83) { // Ctrl+S: save
      evt.preventDefault();
      saveTextAsFile(this.loadedFilename.replace('.in', '.out'), this.exportCommands().concat('END', '').join('\n'));
      Toast("Output file has been saved.");
    }
  }

  handleHover(cell) {
    this.setState({ hover: cell, hoverType: 'cell' });
  }

  buildWithin(current, x, y) {
    const queue = this.state.buildQueue;
    if (current.numBuilt === queue.length) {
      throw new ErrorMessage("You have no structure left to build.");
    }
    return current.build(x, y, queue[current.numBuilt]);
  }

  handleClick(cell, evt) {
    const { x, y } = cell;

    let history = this.state.history;
    let stepNumber = this.state.stepNumber;
    let current = this.currentStep.clone();

    try {
      let toolName = this.state.selectedTools[evt.button === 0 ? 0 : 1];

      switch (toolName) {
        case 'build': {
          this.buildWithin(current, x, y);
          break;
        }

        case 'star':
          current.putStar(x, y);
          break;

        case 'bomb':
          current.putBomb(x, y);
          break;

        default:
          throw new Error("Unknown tool: " + toolName);
      }
    } catch (err) {
      if (err instanceof ErrorMessage) {
        Toast(err.message);
      } else {
        Toast("An unexpected error occured.");
        console.error(err);
      }
      return;
    }

    history = history.slice(0, ++stepNumber).concat(current);
    this.setState({ history, stepNumber });
  }

  handleHistoryHover(item) {
    this.setState({ hover: item, hoverType: 'history' });
  }

  handleCommandExec() {
    const lines = this.commandInput.current.value.split('\n');

    const { stepNumber, history } = this.state;
    const results = [];
    let current = this.currentStep;

    function checkParams(params) {
      if (params.length !== 2) {
        throw new ErrorMessage('There should be exactly 2 params for this command.');
      }
      const [x, y] = params.map(a => {
        a = Number(a);
        if (!Number.isInteger(a)) throw new ErrorMessage('All params should be integers.');
        return a - 1;
      });
      if (!current.grid.inBound(x, y)) throw new ErrorMessage('Coordinates out of range.');
      return [x, y];
    }

    let lineNumber = 0, cntCommands = 0;

    for (let line of lines) {
      lineNumber++;
      line = line.trim();
      if (!line) continue;

      cntCommands++;
      const [command, ...params] = line.split(/\s+/);

      try {
        current = current.clone();

        switch (command.toLowerCase()) {
          case 'put': {
            const [x, y] = checkParams(params);
            this.buildWithin(current, x, y);
            break;
          }
          
          case 'star': {
            const [x, y] = checkParams(params);
            current.putStar(x, y);
            break;
          }
          
          case 'bomber': {
            const [x, y] = checkParams(params);
            current.putBomb(x, y);
            break;
          }
          
          default:
            throw new ErrorMessage(`Unknown command '${command}'.`);
        }

        results.push(current);
      } catch (err) {
        if (err instanceof ErrorMessage) {
          Toast(`Error on line ${lineNumber}: ${err.message}\nExecution was interrupted.`);
          return;
        } else {
          Toast(`An unknown error occured when executing line ${lineNumber}.\nChanges will be rolled back.`);
          return;
        }
      }
    }

    if (cntCommands) {
      Toast(`Success: ${cntCommands} command${cntCommands > 1 ? 's were' : ' was'} executed.`);
    } else {
      Toast('No command was found.');
      return;
    }

    this.setState({
      stepNumber: stepNumber + results.length,
      history: history.slice(0, stepNumber + 1).concat(results)
    });
  }

  handleCommandClear() {
    this.commandInput.current.value = '';
    Toast('Commands have been cleared.');
  }

  /**
   * @param {GameState} current
   * @param {String} too
   * @param {*} coord
   */
  getToolPreview(current, tool, { x, y }) {
    const cell = current.grid.cells[x][y];

    switch (tool) {
      case 'build': {
        const queue = this.state.buildQueue;
        if (current.numBuilt < queue.length && !cell.value) {
          const preview = current.clone();
          const target = preview.grid.cells[x][y];
          const type = queue[current.numBuilt];
          const temp = current.clone();
          const result = temp.build(x, y, type);
          for (const { cells } of result.phase) {
            for (const [x, y] of cells) {
              preview.grid.cells[x][y].reaction = true;
            }
          }
          target.value = temp.grid.cells[x][y].value;
          target.isPreview = true;
          return preview;
        }
        break;
      }

      case 'star': {
        if (current.numStars && !cell.value) {
          const preview = current.clone();
          const target = preview.grid.cells[x][y];
          const temp = current.clone();
          const result = temp.putStar(x, y);
          for (const { cells } of result.phase) {
            for (const [x, y] of cells) {
              preview.grid.cells[x][y].reaction = true;
            }
          }
          target.value = temp.grid.cells[x][y].value;
          target.isPreview = true;
          return preview;
        }
        break;
      }

      default: break;
    }

    return current;
  }

  getDisplayState() {
    const { hover, hoverType } = this.state;
    const current = this.currentStep;

    if (!hover) return current;

    switch (hoverType) {
      case 'cell':
        return this.getToolPreview(current, this.state.selectedTools[0], hover);
      
      case 'history':
        return hover;
      
      default:
        throw new Error('Unknown hover type.');
    }
  }

  renderGameUI() {
    const history = this.state.history;
    const queue = this.state.buildQueue;
    const current = this.getDisplayState();

    const toolButtons = [
      {
        name: 'build', title: 'Build',
        amount: this.state.buildQueue.length - current.numBuilt
      },
      {
        name: 'star', title: 'Star',
        amount: current.numStars
      },
      {
        name: 'bomb', title: 'Bomber',
        amount: current.numBombs
      }
    ].map(({ name, title, amount }) => {
      return (
        <ToolButton
          key={name}
          title={title}
          amount={amount}
          selected={this.state.selectedTools.indexOf(name)}
          onClick={(evt) => this.handleToolSelect(name, evt)}
        />
      );
    });

    const historyItems = history.map((item, index) => {
      return (
        <li
          key={index}
          className={index === this.state.stepNumber ? "active" : ""}
          onMouseOver={() => this.handleHistoryHover(item)}
          onMouseOut={() => this.handleHistoryHover(null)}
          onClick={() => this.setState({ stepNumber: index })}
        >
          {item.command || 'Start'}
        </li>
      );
    });

    const maxQueueLength = 40;
    let queueItems = this.state.buildQueue.slice(current.numBuilt);
    if (queueItems.length > maxQueueLength) {
      let numCut = queueItems.length - maxQueueLength;
      queueItems = queueItems.slice(0, maxQueueLength).concat(`... (${numCut} more)`);
    }
    if (queueItems.length) {
      queueItems = [
        <strong key="first">{queueItems[0]} </strong>,
        <span key="other">{queueItems.slice(1).join(' ')}</span>
      ]; 
    } else {
      queueItems = <span>(queue empty)</span>;
    }

    return (
      <div className="game">
        <div>
          <div className="game-toolbar">
            {toolButtons}
          </div>
        </div>
        <div>
          <div className="game-queue">
            {queueItems}
          </div>
        </div>
        <div>
          <div className="game-board">
            <Board
              grid={current.grid}
              onHover={this.handleHover}
              onClick={this.handleClick}
            />
          </div>
          <div className="game-info">
            <ul>
              <li>Board: {this.state.width} x {this.state.height}</li>
              <li>Round: {this.state.stepNumber}</li>
              <li>Score: {current.score}</li>
              <li>Queue: {current.numBuilt} / {queue.length}</li>
              <li>Stars: {current.numStars}</li>
              <li>Bombers: {current.numBombs}</li>
            </ul>
          </div>
          <div className="game-history">
            <ol start="0">
              {historyItems}
            </ol>
          </div>
          <div className="game-command-input">
            <div>
              <textarea
                rows="15"
                cols="15"
                ref={this.commandInput}
                onMouseDown={(evt) => evt.target.readOnly = false}
                onBlur={(evt) => evt.target.readOnly = true} // Fix auto focus
                onKeyDown={(evt) => evt.nativeEvent.stopImmediatePropagation()}
              ></textarea>
              <input type="hidden" id="fix-focus" />
            </div>
            <div className="actions">
              <input type="button" value="Execute" onClick={this.handleCommandExec} />
              <input type="button" value="Clear" onClick={this.handleCommandClear} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    return (
      <div>
        <div className="game-file-select">
          <input type="file" ref={this.fileInput} />
          <input type="button" value="Start" onClick={() => this.handleFileSelect()} />
        </div>
        {this.state.loaded && this.renderGameUI()}
      </div>
    );
  }
}

export default Game;
