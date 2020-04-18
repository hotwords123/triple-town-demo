import React from 'react';
import './Game.css';

import { makeClassName, ErrorMessage, copyText, saveTextAsFile } from "./utility";
import parseInputFile from "./input-parser";
import { GameState } from "./game-logic";
import Toast from './Toast';

class BoardCell extends React.Component {
  render() {
    const classTags = this.props.classTag.map(tag => 'board-cell-' + tag);

    return (
      <div
        className={makeClassName('board-cell', classTags)}
        onMouseOver={this.props.onHover}
        onMouseUp={this.props.onClick}
        onContextMenu={(evt) => evt.preventDefault()}
      >
        {this.props.value}
      </div>
    );
  }
}

class Board extends React.Component {
  renderCell({ x, y, value }) {
    const classTag = [value ? value : 'empty'];

    return (
      <BoardCell
        key={`${x},${y}`}
        value={value}
        classTag={classTag}
        onHover={() => this.props.onHover(x, y)}
        onClick={(evt) => this.props.onClick(x, y, evt)}
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
      preview: null
    };
    this.fileInput = React.createRef();
  }

  componentDidMount() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
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
    if (!this.state.loaded || this.state.preview) return;
    if (evt.ctrlKey && evt.which === 90) { // Ctrl+Z: undo
      const stepNumber = this.state.stepNumber;
      if (stepNumber > 0) {
        this.setState({ stepNumber: stepNumber - 1 });
      }
    }
    if (evt.ctrlKey && evt.which === 89) { // Ctrl+Y: redo
      const stepNumber = this.state.stepNumber;
      if (stepNumber < this.state.history.length - 1) {
        this.setState({ stepNumber: stepNumber + 1 });
      }
    }
    if (evt.ctrlKey && evt.which === 67) { // Ctrl+C: copy
      evt.preventDefault();
      copyText(this.exportCommands().join('\n'));
      Toast('Operations have been copied to clipboard.');
    }
    if (evt.ctrlKey && evt.which === 83) { // Ctrl+S: save
      evt.preventDefault();
      saveTextAsFile(this.loadedFilename.replace('.in', '.out'), this.exportCommands().concat('END').join('\n'));
      Toast('Output file has been saved.');
    }
  }

  handleHover(x, y) {
    if (!this.state.loaded || this.state.preview) return;
  }

  handleClick(x, y, evt) {
    if (!this.state.loaded || this.state.preview) return;

    let history = this.state.history;
    let stepNumber = this.state.stepNumber;
    let current = this.currentStep.clone();

    try {
      let toolName = this.state.selectedTools[evt.button === 0 ? 0 : 1];

      switch (toolName) {
        case 'build':
          const queue = this.state.buildQueue;
          if (current.numBuilt === queue.length) {
            throw new ErrorMessage("You have no structure left to be built.");
          }

          let result = current.build(x, y, queue[current.numBuilt]);
          // todo: animation
          console.log(result);
          break;

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

  jumpTo(step) {
    this.setState({
      stepNumber: step
    });
  }

  renderGameUI() {
    const history = this.state.history;
    const current = this.state.preview || this.currentStep;
    const queue = this.state.buildQueue;

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

    const historyItems = history.map((state, index) => {
      return (
        <li
          key={index}
          className={index === this.state.stepNumber ? "active" : ""}
          onMouseOver={() => this.setState({ preview: state })}
          onMouseOut={() => this.setState({ preview: null })}
          onClick={() => this.jumpTo(index)}
        >
          {state.command || '(start)'}
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
              onHover={(x, y) => this.handleHover(x, y)}
              onClick={(x, y, evt) => this.handleClick(x, y, evt)}
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
