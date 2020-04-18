
function splitInt(str) {
  return str.split(' ').map(a => parseInt(a));
}

export default function parseInputFile(rawData) {
  let lines = rawData.split(/\r?\n/).map(a => a.trim()).filter(a => a.length > 0);

  let [height, width] = splitInt(lines[0]);
  let [numStars, numBombs] = splitInt(lines[1]);
  let grid = lines.slice(2, 2 + height).map(row => {
    return row.split('').map(cell => cell === '.' ? null : parseInt(cell));
  });
  let queue = lines[2 + height] === '0' ? [] : splitInt(lines[3 + height]);

  return {
    width, height,
    numStars, numBombs,
    grid, queue
  };
}
