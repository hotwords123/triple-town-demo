
const config = {
  reaction: {
    minCount: 3
  },
  scoring: {
    build: [null, 4, 20, 100, 500, 1500, 5000, 2e4, 1e5, 5e5],
    bomb: {
      ratio: 0.5
    }
  }
};

export default config;
