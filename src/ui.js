export function updateHud(game) {
  return game.updateHUD();
}

export function refreshBuildList(game) {
  return game._refreshBuildList();
}

export function renderSelection(game, turret) {
  return game.selectTurret(turret);
}
