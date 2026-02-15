export class WaveManager {
  constructor(game) {
    this.game = game;
  }

  startWave() {
    return this.game.startWave();
  }

  spawnEnemy(typeKey, startD = 0, scalarOverride = null, eliteTag = null) {
    return this.game.spawnEnemy(typeKey, startD, scalarOverride, eliteTag);
  }
}
