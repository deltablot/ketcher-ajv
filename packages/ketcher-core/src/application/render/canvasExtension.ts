import { Vec2 } from 'domain/entities';
import { Editor, ReAtom, fromMultipleMove } from 'ketcher-core';

const edgeOffset = 150;
const scrollMultiplier = 2;
let lastX = 0;
let lastY = 0;

export function getDirections(event) {
  const layerX = event.offsetX;
  const layerY = event.offsetY;
  const isMovingRight = layerX > lastX;
  const isMovingLeft = layerX < lastX;
  const isMovingTop = layerY < lastY;
  const isMovingBottom = layerY > lastY;
  lastX = layerX;
  lastY = layerY;
  return { isMovingRight, isMovingLeft, isMovingTop, isMovingBottom };
}

export function isSelectionCloseToTheEdgeOfCanvas(editor: Editor) {
  const canvasSize = editor.render.sz;
  const selectedAreaCoordinates = getSelectedAreaCoordinates(editor);
  if (!selectedAreaCoordinates) {
    return false;
  }
  const { leftX, topY, rightX, bottomY } = selectedAreaCoordinates;
  const isCloseToTopEdgeOfCanvas = topY <= edgeOffset;
  const isCloseToBottomEdgeOfCanvas = canvasSize.y - bottomY <= edgeOffset;
  const isCloseToLeftEdgeOfCanvas = leftX <= edgeOffset;
  const isCloseToRightEdgeOfCanvas = canvasSize.x - rightX <= edgeOffset;
  return {
    isCloseToLeftEdgeOfCanvas,
    isCloseToTopEdgeOfCanvas,
    isCloseToRightEdgeOfCanvas,
    isCloseToBottomEdgeOfCanvas,
  };
}

export function isSelectionCloseToTheEdgeOfScreen(editor: Editor) {
  const clientArea = editor.render.clientArea;
  const clientAreaBoundingRect = clientArea.getBoundingClientRect();
  const canvas = editor.render.paper.canvas;
  const canvasBoundingRect = canvas.getBoundingClientRect();
  const selectedAreaCoordinates = getSelectedAreaCoordinates(editor);
  if (!selectedAreaCoordinates) {
    return false;
  }
  const { leftX, topY, rightX, bottomY } = selectedAreaCoordinates;
  const atomXOffset = canvasBoundingRect.x - clientAreaBoundingRect.x;
  const atomYOffset = canvasBoundingRect.y - clientAreaBoundingRect.y;
  const isCloseToTopEdgeOfScreen = topY + atomYOffset <= edgeOffset;
  const isCloseToBottomEdgeOfScreen =
    clientArea.clientHeight - (bottomY + atomYOffset) <= edgeOffset;
  const isCloseToLeftEdgeOfScreen = leftX + atomXOffset <= edgeOffset;
  const isCloseToRightEdgeOfScreen =
    clientArea.clientWidth - (rightX + atomXOffset) <= edgeOffset;
  return {
    isCloseToLeftEdgeOfScreen,
    isCloseToTopEdgeOfScreen,
    isCloseToRightEdgeOfScreen,
    isCloseToBottomEdgeOfScreen,
  };
}

export function calculateCanvasExtension(
  clientArea,
  currentCanvasSize,
  extensionVector,
) {
  const newHorizontalScrollPosition = clientArea.scrollLeft + extensionVector.x;
  const newVerticalScrollPosition = clientArea.scrollTop + extensionVector.y;
  let horizontalExtension = 0;
  let verticalExtension = 0;
  if (newHorizontalScrollPosition > currentCanvasSize.x) {
    horizontalExtension = newHorizontalScrollPosition - currentCanvasSize.x;
  }
  if (newHorizontalScrollPosition < 0) {
    horizontalExtension = Math.abs(newHorizontalScrollPosition);
  }
  if (newVerticalScrollPosition > currentCanvasSize.y) {
    verticalExtension = newVerticalScrollPosition - currentCanvasSize.y;
  }
  if (newVerticalScrollPosition < 0) {
    verticalExtension = Math.abs(newVerticalScrollPosition);
  }
  return new Vec2(horizontalExtension, verticalExtension, 0);
}

export function shiftByVector(vector: Vec2, editor: Editor) {
  const render = editor.render;
  const clientArea = render.clientArea;
  const extensionVector = calculateCanvasExtension(
    clientArea,
    render.sz.scaled(render.options.zoom),
    vector,
  ).scaled(1 / render.options.zoom);

  if (extensionVector.x > 0 || extensionVector.y > 0) {
    // When canvas extends previous (0, 0) coordinates may become (100, 100)
    lastX += extensionVector.x;
    lastY += extensionVector.y;
  }
  render.update(false);
  scrollToEdgeOfScreen(vector, render);
}

export function scrollByVector(vector: Vec2, render) {
  requestAnimationFrame(() => {
    const clientArea = render.clientArea;
    clientArea.scrollLeft +=
      (vector.x * render.options.scale) / scrollMultiplier;
    clientArea.scrollTop +=
      (vector.y * render.options.scale) / scrollMultiplier;
  });
}

export function scrollToEdgeOfScreen(vector: Vec2, render) {
  requestAnimationFrame(() => {
    const clientArea = render.clientArea;
    if (vector.x < 0) {
      clientArea.scrollLeft = 0;
    }
    if (vector.x > 0) {
      clientArea.scrollLeft = clientArea.scrollWidth;
    }
    if (vector.y < 0) {
      clientArea.scrollTop = 0;
    }
    if (vector.y > 0) {
      clientArea.scrollTop = clientArea.scrollHeight;
    }
  });
}

export function moveSelected(
  editor: Editor,
  destinationVector: Vec2,
  isFast: boolean,
  direction: string,
) {
  const stepFactor = 1 / editor.options().scale;
  const fasterStepFactor = stepFactor * 10;
  const selectedItems = editor.explicitSelected();
  const action = fromMultipleMove(
    editor.render.ctab,
    selectedItems,
    destinationVector.scaled(isFast ? fasterStepFactor : stepFactor),
  );
  editor.update(action, false, { resizeCanvas: true });

  const {
    isCloseToEdgeOfCanvasAndMovingToEdge,
    isCloseToEdgeOfScreenAndMovingToEdge,
  } = isCloseToTheEdges(editor, direction);
  if (isCloseToEdgeOfCanvasAndMovingToEdge) {
    scrollToEdgeOfScreen(destinationVector, editor.render);
  } else if (isCloseToEdgeOfScreenAndMovingToEdge) {
    scrollByVector(destinationVector, editor.render);
  }
}

function getSelectedAreaCoordinates(editor: Editor) {
  const restruct = editor.render.ctab;
  const selectedItems = editor.explicitSelected();
  if (!selectedItems.atoms) {
    return false;
  }
  let theMostTopAtom = restruct.atoms.get(selectedItems?.atoms[0]);
  let theMostBottomAtom = restruct.atoms.get(selectedItems?.atoms[0]);
  let theMostRightAtom = restruct.atoms.get(selectedItems?.atoms[0]);
  let theMostLeftAtom = restruct.atoms.get(selectedItems?.atoms[0]);
  selectedItems.atoms.forEach((atomId) => {
    const atom = restruct.atoms.get(atomId);
    const position = atom?.a.pp;
    if (position && theMostTopAtom) {
      theMostTopAtom =
        position.y < theMostTopAtom.a.pp.y ? atom : theMostTopAtom;
    }
    if (position && theMostBottomAtom) {
      theMostBottomAtom =
        position.y > theMostBottomAtom.a.pp.y ? atom : theMostBottomAtom;
    }
    if (position && theMostRightAtom) {
      theMostRightAtom =
        position.x > theMostRightAtom.a.pp.x ? atom : theMostRightAtom;
    }
    if (position && theMostLeftAtom) {
      theMostLeftAtom =
        position.x < theMostLeftAtom.a.pp.x ? atom : theMostLeftAtom;
    }
  });
  if (
    theMostTopAtom &&
    theMostBottomAtom &&
    theMostRightAtom &&
    theMostLeftAtom
  ) {
    const scale = editor.options().scale;
    const offset = editor.render.options.offset;

    const getScreenCoordinates = (atom: ReAtom) =>
      atom.a.pp.scaled(scale).add(offset);

    const theMostTopAtomYCoordinate = getScreenCoordinates(theMostTopAtom).y;
    const theMostBottomAtomYCoordinate =
      getScreenCoordinates(theMostBottomAtom).y;
    const theMostRightAtomXCoordinate =
      getScreenCoordinates(theMostRightAtom).x;
    const theMostLeftAtomXCoordinate = getScreenCoordinates(theMostLeftAtom).x;
    return {
      leftX: theMostLeftAtomXCoordinate,
      topY: theMostTopAtomYCoordinate,
      rightX: theMostRightAtomXCoordinate,
      bottomY: theMostBottomAtomYCoordinate,
    };
  }
  return false;
}

function isCloseToTheEdges(editor: Editor, direction: string) {
  const result = {
    isCloseToEdgeOfCanvasAndMovingToEdge: false,
    isCloseToEdgeOfScreenAndMovingToEdge: false,
  };
  const selectedItems = editor.explicitSelected();
  if (!selectedItems.atoms) {
    return result;
  }

  const isCloseToEdgeOfCanvas = isSelectionCloseToTheEdgeOfCanvas(editor);
  if (isCloseToEdgeOfCanvas) {
    const {
      isCloseToLeftEdgeOfCanvas,
      isCloseToTopEdgeOfCanvas,
      isCloseToRightEdgeOfCanvas,
      isCloseToBottomEdgeOfCanvas,
    } = isCloseToEdgeOfCanvas;
    result.isCloseToEdgeOfCanvasAndMovingToEdge =
      (isCloseToTopEdgeOfCanvas && direction === 'MoveUp') ||
      (isCloseToBottomEdgeOfCanvas && direction === 'MoveDown') ||
      (isCloseToLeftEdgeOfCanvas && direction === 'MoveLeft') ||
      (isCloseToRightEdgeOfCanvas && direction === 'MoveRight');
  }
  const isCloseToEdgeOfScreen = isSelectionCloseToTheEdgeOfScreen(editor);
  if (isCloseToEdgeOfScreen) {
    const {
      isCloseToLeftEdgeOfScreen,
      isCloseToTopEdgeOfScreen,
      isCloseToRightEdgeOfScreen,
      isCloseToBottomEdgeOfScreen,
    } = isCloseToEdgeOfScreen;
    result.isCloseToEdgeOfScreenAndMovingToEdge =
      (isCloseToTopEdgeOfScreen && direction === 'MoveUp') ||
      (isCloseToBottomEdgeOfScreen && direction === 'MoveDown') ||
      (isCloseToLeftEdgeOfScreen && direction === 'MoveLeft') ||
      (isCloseToRightEdgeOfScreen && direction === 'MoveRight');
  }
  return result;
}
