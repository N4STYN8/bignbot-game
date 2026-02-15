export function bindInput(game) {
  return game._bindUI();
}

export function handleCanvasClick(game, x, y) {
  return game.onClick(x, y);
}
