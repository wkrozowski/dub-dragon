/**
 * Date: 2022-06-13
 * Author: gaelanmcmillan
 * Note: I'm sorry this is all in one file. I tried to modularize it, but p5 doesn't play very well with <script type="module">
 */

//===========================================================================//

// ┌─────────┐
// │ Globals │
// └─────────┘

var CANVAS;

var GENERATE_CODE_BUTTON;
var CODE_DISPLAY_AREA;
var DEFAULT_TRANSITION_TOGGLE;
var DEFAULT_TRANSITION_ENABLED = false;

var ACTION_MODIFICATION_TEXT_INPUT;
var ACTION_MODIFICATION_TEXT_INPUT_ACTIVE = false;
var ACTION_TO_MODIFY;


var MAIN_CHART;
var TEST_STATE;

var ELEMENT_BEING_MOVED;
var ELEMENT_BEING_MOVED_OFFSET = {x:0, y:0};

var SELECTED_ENTITY;
var SELECT_FILL_COL = [220,255,220];
var SELECT_STROKE_COL = [0,160,0];

var OSC;

var TOOL_RADIO;
var TOOL_SELECTION;

var IS_DRAGGING = false;

//===========================================================================//

// ┌───────────┐
// │ Utilities │
// └───────────┘

let currentStateNumber = 0;
function generateStateName() {
  if (currentStateNumber==0) {
    currentStateNumber++;
    return "init";
  }

  return `s${currentStateNumber++}`
}

/**
 * is x inside the circle?
 *     __.__
 *   /     x \ 
 *  |         |
 *   \       /
 *     ^^-^^
 */
function circleCollision(cx,cy,cd,px,py) {
  let cr = cd / 2.0;
  return ((px-cx)*(px-cx) <= cr*cr && (py-cy)*(py-cy) <= cr*cr); 
}

/**
 * Generate a new function that can be called to check if a state or transition is colliding with a point [x,y]
 * @param {*} x 
 * @param {*} y 
 * @returns 
 */
function collisionCheckWithPoint(x, y) {
  return (e) => { return e.collidesWith(x,y); }
}

function lineMidpoint(sx, sy, ex, ey) {
  return [ sx + (ex-sx)/2, sy + (ey-sy)/2 ];
}

function findAndRemove(array, predicate) {
  for (let i = array.length-1; i >= 0; --i) {
    if (predicate(array[i])){
      array.splice(i,1);
    }
  }
}

function pointDistance(ox,oy,dx,dy) {
  return {x: dx-ox, y: dy-oy};
}

/**
 * // this function parameterizes the line (x1,y1)->(x2,y2) by a value t between 0 and 1
 * @param {*} x1 
 * @param {*} y1 
 * @param {*} x2 
 * @param {*} y2 
 * @returns 
 */
function parametrizedLineFunction(x1,y1,x2,y2) {
  return (t) => [x2 + t*(x1-x2), y2 + t*(y1-y2)]
}
/**
 * Returns a point [x,y] that is offset from the given line by a certain distance tangent to the given point on the line.
 * @param {*} lineStartX 
 * @param {*} lineStartY 
 * @param {*} lineEndX 
 * @param {*} lineEndY 
 * @param {*} pointX 
 * @param {*} pointY 
 * @param {*} distance 
 */
function pointTangentToLineAtDistance(lineStartX, lineStartY, lineEndX, lineEndY, pointX, pointY, distance) {
  let x1 = lineStartX;
  let y1 = lineStartY;
  let x2 = lineEndX;
  let y2 = lineEndY;
  let px = pointX;
  let py = pointY;

  let p = parametrizedLineFunction(x1,y1,x2,y2);
  let r = pointDistance(px,py,x2,y2);
  // let t = r/Math.sqrt((x1-x2)**2 + (y1-y2)**2);
}

/**
 * Assuming some line ends at the center of a circle, return the point at which the line and circle intersect.
 * 
 * https://math.stackexchange.com/questions/3060488/how-to-find-intersection-points-of-circle-and-line-given-only-a-radius-and-end-p
 * @param {*} lineStartX 
 * @param {*} lineStartY 
 * @param {*} circleCenterX 
 * @param {*} circleCenterY 
 * @param {*} circleRadius 
 */
function lineCircleIntersection (lineStartX, lineStartY, circleCenterX, circleCenterY, circleRadius) {
  let x = lineStartX;
  let y = lineStartY;
  let a = circleCenterX; // these two coordinates also happen to be
  let b = circleCenterY; // the end coordinates of the line
  let r = circleRadius;

  let p = parametrizedLineFunction(x,y,a,b);
  let t = r/Math.sqrt((x-a)**2 + (y-b)**2)

  return p(t);
}










//===========================================================================//

// ┌─────────┐
// │ Classes │
// └─────────┘

// This is where Chart, Node, State, and Transition are defined.

class Chart {
  constructor () {
    this.initialState = new State(100, height/2);
    this.currentState = this.initialState;

    this.states = [this.initialState];
    this.transitions = [];
  }

  addState(state) {
    this.states.push(state);
  }

  deleteElement(elem) {
    if (elem instanceof State) {
      console.log("Deleting state:", elem.name);
      findAndRemove(this.states, (e) => e === elem);
      findAndRemove(this.transitions, (e) => (e.origin === elem || e.destination === elem))
    } else if (elem instanceof Transition) {
      console.log("Deleting transition:", `${elem.origin.name} -> ${elem.destination.name}`);
      findAndRemove(this.transitions, (e) => e === elem);
    }
  }


  /**
   * Adds a new transition to between the origin and destination
   * @param {*} origin 
   * @param {*} destination 
   */
  addTransition(originState, destinationState) {
    let transition = new Transition(originState, destinationState);
    originState.addNeighbor(transition);
    this.transitions.push(transition);
  }

  /**
   * Check every state and transition object in the chart to see if its being clicked on
   * @param {*} x 
   * @param {*} y 
   * @returns 
   */
  pollCollision(x,y) {
    let collisionCheck = collisionCheckWithPoint(x,y);

    for (let state of this.states) {
      if (collisionCheck(state)) return state;
    }

    for (let transition of this.transitions) {
      if (collisionCheck(transition)) return transition;
    }

    return null;
  }

  /**
   * Traverses the states and transitions of the chart to see if any of them satisfy
   * the unary predicate supplied in predicate. ((Didn't actually need this afterall))
   */
  query(predicate) {
    let seen = new Set([this.initialState]);
    let queue = [this.initialState]

    while (queue.length) { // while the queue is not empty
      let curr = queue.shift();

      if (predicate(curr)) {
        return curr;
      }

      for (let neighbor of curr.neighbors) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return null;
  } // end of Chart


  asSonicPiObject() {
    let chartObj = {};
    for (let state of this.states) {
      let [stateName, stateObject] = state.asSonicPiObject();
      chartObj[stateName] = stateObject;
    }
    return chartObj;
  }


  checkCollisionAndRender(collisionCheck, group) {
    for (let elem of group) {
      if (collisionCheck(elem)) {
        elem.hover();
      } else {
        elem.dehover();
      }
      elem.show();
    }
  }

  visualize() {
    let collisionCheck = collisionCheckWithPoint(mouseX, mouseY)
    this.checkCollisionAndRender(collisionCheck, this.transitions);
    this.checkCollisionAndRender(collisionCheck, this.states);
  }
}

class Node {
  constructor() {
    this.neighbors = []
  }

  addNeighbor (node) {
    this.neighbors.push(node);
  }
}

class State extends Node {
  CIRCLE_DIAM = 30;
  STROKE_WEIGHT = 1;
  STROKE_COL = [0,0,0];
  FILL_COL = [255,255,255];
  
  constructor(px, py) {
    super();
    this.name = generateStateName();
    this.x = px;
    this.y = py;
    this.isSelected = false;

    console.log(`Created new State(${this.x}, ${this.y})`);
  }

  select() {
    this.STROKE_COL = SELECT_STROKE_COL;
    this.FILL_COL = SELECT_FILL_COL;
  }

  deselect() {
    this.STROKE_COL = [0,0,0];
    this.FILL_COL = [255,255,255];
  }

  hover() {
    this.STROKE_WEIGHT = 2;
  }

  dehover() {
    this.STROKE_WEIGHT = 1;
  }

  collidesWith(x,y) {
    let [cx,cy,cd] = [this.x, this.y, this.CIRCLE_DIAM];
    return circleCollision(cx,cy,cd,x,y);
  }

  show () {
    push();
    
    strokeWeight(this.STROKE_WEIGHT);
    stroke(...this.STROKE_COL);
    fill(...this.FILL_COL);
    circle(this.x, this.y, this.CIRCLE_DIAM);

    noStroke();
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(8);
    text(this.name, this.x, this.y);

    pop();
  }

  asSonicPiObject() {
    let transitionArray;

    if (this.neighbors.length) 
      transitionArray = this.neighbors.map(transition => transition.assignEqualProbability(this.neighbors.length).asSonicPiObject())
    else {
      if (DEFAULT_TRANSITION_ENABLED) {
        console.log("Adding default transition from", this.name,"to",MAIN_CHART.initialState.name);
        transitionArray = new Transition(this, MAIN_CHART.initialState).assignEqualProbability(1).asSonicPiObject();
      }
    }
    return [this.name, { "test1" : transitionArray }];
  }
} // end of State

class Transition extends Node {

  LABEL_DIAM = 20;
  STROKE_WEIGHT = 1;
  FILL_COL = [255,255,255];
  STROKE_COL = [0,0,0];

  constructor(origin, destination) {
    super();
    this.origin = origin;
    this.destination = destination;
    this.addNeighbor(destination);
    this.action = new PlayNoteAction("C4", "1/4");
    this.isSelected = false;
  }

  show() {
    push();

    

    strokeWeight(this.STROKE_WEIGHT);
    stroke(...this.STROKE_COL);
    line(this.origin.x, this.origin.y, this.destination.x, this.destination.y);

    

    fill(...this.FILL_COL);
    // circle(cx,cy, this.LABEL_DIAM);

    let [t1x, t1y] = lineCircleIntersection(this.origin.x, this.origin.y, this.destination.x, this.destination.y, this.destination.CIRCLE_DIAM/2);
    let [t2x, t2y] = lineCircleIntersection(this.origin.x, this.origin.y, this.destination.x, this.destination.y, this.destination.CIRCLE_DIAM/2 + 3);
    let [t3x, t3y] = lineCircleIntersection(this.origin.x, this.origin.y, this.destination.x, this.destination.y, this.destination.CIRCLE_DIAM/2 + 6);

    push();
    strokeWeight(2);
    point(t1x,t1y);
    strokeWeight(4);
    point(t2x,t2y);
    strokeWeight(6);
    point(t3x,t3y);
    pop();

    // Show the action if the note is selected
    // if (this.isSelected) {
      let [cx, cy] = lineMidpoint(this.origin.x, this.origin.y, this.destination.x, this.destination.y);
      this.action.show(cx,cy);
    // }

    pop();
  }

  collidesWith(x,y) {
    let [cx,cy] = lineMidpoint(this.origin.x, this.origin.y, this.destination.x, this.destination.y);
    let cd = this.LABEL_DIAM;
    return circleCollision(cx,cy,cd,x,y);
  }

  hover() {
    this.STROKE_WEIGHT = 2;
  }

  dehover() {
    this.STROKE_WEIGHT = 1;
  }

  select() {
    this.isSelected = true;
    this.FILL_COL = SELECT_FILL_COL;
    this.STROKE_COL = SELECT_STROKE_COL;
  }

  deselect() {
    this.isSelected = false;
    this.FILL_COL = [255,255,255];
    this.STROKE_COL = [0,0,0];
  }

  assignEqualProbability(length) {
    this.probability = `1/${length}`;
    return this;
  }

  asSonicPiObject() {
    let actionString = this.action ? this.action.asSonicPiObject() : [ "C4", "1/2" ];
    return [this.probability, actionString, this.destination.name];
  }
} // end of Transition

class Action {
  constructor(type) {
    this.type = type;
  }

  consume() {
    console.log("Consuming action");
  }
}

class PlayNoteAction extends Action {
  BOX_WIDTH = 35;
  BOX_HEIGHT = 16;
  TEXT_SIZE = 8;
  constructor(note, duration) {
    super("play note");
    this.note = note;
    this.duration = duration;
  }

  asSonicPiObject() {
    return [this.note, this.duration];
  }

  consume() {
    console.log(`Playing note: ${this.note}, ${this.duration}`);
  }

  toString() {
    return `${this.note}, ${this.duration}`
  }

  show(x,y) {
    push();
    fill(220);
    rectMode(CENTER, CENTER);
    rect(x,y,this.BOX_WIDTH,this.BOX_HEIGHT);
    noStroke();
    fill(0);
    textSize(this.TEXT_SIZE);
    textAlign(CENTER, CENTER);
    
    if (ACTION_TO_MODIFY != this)
      text(this.toString(),x,y);
    pop();
  }
}




//===========================================================================//

// ┌────────────────┐
// │ Keyboard Input │
// └────────────────┘

function keyPressed() {
  if (keyCode === BACKSPACE) {
    if (SELECTED_ENTITY && SELECTED_ENTITY != MAIN_CHART.initialState && !ACTION_MODIFICATION_TEXT_INPUT_ACTIVE) {
      MAIN_CHART.deleteElement(SELECTED_ENTITY);
      SELECTED_ENTITY = null;
    }
  }

  if (keyCode === ENTER && ACTION_MODIFICATION_TEXT_INPUT_ACTIVE) {
    ACTION_MODIFICATION_TEXT_INPUT.cleanup();
    
  }
}

//===========================================================================//

/**
 * Query all objects of the main chart to see if the mouse
 * is intersection with any of them. If it is, update the selected entity
 * to the given object
 */
function updateEntitySelection() {
  if (SELECTED_ENTITY) {
    SELECTED_ENTITY.deselect();
    SELECTED_ENTITY = null;
  }

  let new_selection = MAIN_CHART.pollCollision(mouseX, mouseY);

  if (new_selection) {
    SELECTED_ENTITY = new_selection;
    SELECTED_ENTITY.select();
  }
}

function attemptToAddTransition() {
  let HOVERED_ENTITY = MAIN_CHART.pollCollision(mouseX, mouseY);

  if ((HOVERED_ENTITY && SELECTED_ENTITY) && (HOVERED_ENTITY !== SELECTED_ENTITY)) {
    MAIN_CHART.addTransition(SELECTED_ENTITY, HOVERED_ENTITY);
  }

}

//===========================================================================//

// ┌─────────────────┐
// │ Mouse Functions │
// └─────────────────┘

function mousePressed() {
  // deselect current selection
  updateEntitySelection();

  if (TOOL_SELECTION == "edit") {
    ELEMENT_BEING_MOVED = MAIN_CHART.pollCollision(mouseX, mouseY);

    if (ELEMENT_BEING_MOVED) {
      ELEMENT_BEING_MOVED_OFFSET = pointDistance(
        ELEMENT_BEING_MOVED.x,
        ELEMENT_BEING_MOVED.y,
        mouseX,
        mouseY
      );
    } 
  }

  
}

function handleActionModification(collidedObject) {
  ACTION_TO_MODIFY = collidedObject.action;

  ACTION_MODIFICATION_TEXT_INPUT_ACTIVE = true;
  ACTION_MODIFICATION_TEXT_INPUT.value(collidedObject.action.toString());

  ACTION_MODIFICATION_TEXT_INPUT.submitModification = () => {
    let [newNote, newDuration]= ACTION_MODIFICATION_TEXT_INPUT.value().split(",").map(e=>e.trim());

    if (!(newNote && newDuration)) { console.log("Bad input for action modification"); return; }

    console.log("Submitting modification on action", collidedObject.action.toString(), `- updating action to "${newNote}", "${newDuration}"`);
    collidedObject.action.note = newNote;
    collidedObject.action.duration = newDuration;
  } 

  ACTION_MODIFICATION_TEXT_INPUT.cleanup = () => {
    ACTION_MODIFICATION_TEXT_INPUT.submitModification();
    ACTION_MODIFICATION_TEXT_INPUT.hide();
    ACTION_TO_MODIFY = null;
    ACTION_MODIFICATION_TEXT_INPUT_ACTIVE = false;
  }

  let [cx,cy] = lineMidpoint(collidedObject.origin.x, collidedObject.origin.y, collidedObject.destination.x, collidedObject.destination.y);
  let [bw,bh] = [collidedObject.action.BOX_WIDTH, collidedObject.action.BOX_HEIGHT]
  let [magicX, magicY] = [6,7];

  ACTION_MODIFICATION_TEXT_INPUT.position(cx - bw/2 + magicX, cy - bh/2 + magicY);
  ACTION_MODIFICATION_TEXT_INPUT.size(bw,bh);
  ACTION_MODIFICATION_TEXT_INPUT.show();
}

function doubleClicked() {
  let collidedObject = MAIN_CHART.pollCollision(mouseX, mouseY);
  if (!collidedObject) {
    MAIN_CHART.addState(new State(mouseX, mouseY));
  } else {
    if (collidedObject instanceof Transition) {
      handleActionModification(collidedObject);
    }
  }
}

function mouseReleased() {
  if (TOOL_SELECTION == "insert")
    attemptToAddTransition();

  if (ELEMENT_BEING_MOVED) {
    ELEMENT_BEING_MOVED = null;

  }
}

//===========================================================================//

// function playFreq(freq, osc = OSC) {
//   console.log("playing sound");

//   osc.amp(0,0.1);
//   osc.start();

//   osc.freq(freq, 0.1);
//   osc.amp(0.5, 0.4);

//   osc.amp(0, 2.0);
// }


// ┌──────────────┐
// │ p5 Functions │
// └──────────────┘

function drawPlus(x,y,size) {
  line(x, y-size, x, y+size);
  line(x-size, y, x+size, y);
}

function handleToolVisualization() {

  if (TOOL_SELECTION === "insert") {
    push();
    stroke(...[0,0,0]);
    strokeWeight(1);
    let [ox, oy] = [-3,-3];
    let [x, y] = [mouseX, mouseY];
    drawPlus(x+ox, y+oy, 2);
    pop()

    cursor(ARROW);

  } else if (TOOL_SELECTION === "edit") {
    cursor('grab');
  } else {

  }
}

function drawLineFromSelectedEntity() {
  push();

  let newCollision = MAIN_CHART.query(collisionCheckWithPoint(mouseX, mouseY));

  if (newCollision !== null && newCollision !== SELECTED_ENTITY) {
    strokeWeight(2);
  } else {
    strokeWeight(1);
  }

  line(
    SELECTED_ENTITY.x,
    SELECTED_ENTITY.y,
    mouseX,
    mouseY
  );

  pop();
}

function handleClickAndDragFromNode() {
  if (mouseIsPressed && SELECTED_ENTITY && TOOL_SELECTION == "insert") {
    drawLineFromSelectedEntity();
  }
}

function handleMovingObjects() {
  if (ELEMENT_BEING_MOVED) {
    ELEMENT_BEING_MOVED.x = mouseX - ELEMENT_BEING_MOVED_OFFSET.x;
    ELEMENT_BEING_MOVED.y = mouseY - ELEMENT_BEING_MOVED_OFFSET.y;
  }
}

function handleToolSelection() {
  TOOL_SELECTION = (keyIsPressed && keyCode === ALT) ? "edit" : "insert";
}

//===========================================================================//

// ┌────────────────┐
// │ Initialization │
// └────────────────┘

function initializeUI() {
  DEFAULT_TRANSITION_TOGGLE = createCheckbox("make transitionless states return to the intial state by default", false);
  DEFAULT_TRANSITION_TOGGLE.changed( () => DEFAULT_TRANSITION_ENABLED = !DEFAULT_TRANSITION_ENABLED );

  
  GENERATE_CODE_BUTTON = createButton("convert chart to JSON string");
  
  GENERATE_CODE_BUTTON.mouseClicked(() => {
    CODE_DISPLAY_AREA.html(`<pre><code>${JSON.stringify(MAIN_CHART.asSonicPiObject(), null, 2)}</code></pre>`)
  });
  
  CODE_DISPLAY_AREA = createDiv();

  ACTION_MODIFICATION_TEXT_INPUT = createInput();
  ACTION_MODIFICATION_TEXT_INPUT.style("font-size", "8px");
  ACTION_MODIFICATION_TEXT_INPUT.style("background", "#dcdcdc00");
  ACTION_MODIFICATION_TEXT_INPUT.style("border", "0px");
  ACTION_MODIFICATION_TEXT_INPUT.style("text-align", "center");
  ACTION_MODIFICATION_TEXT_INPUT.hide();
}

function displayControlsNotice() {

  push();
  text("dub-dragon UI prototype", 20,20);
  text("- double click to add new states",30,40);
  text("- click and drag between states to create a new transition", 30, 55);
  text("- hold alt and drag to move state objects", 30, 70);
  text("- press backspace to delete the selected state or transition", 30, 85);
  pop();
}
// ┌────────────────┐
// │ Setup and Draw │
// └────────────────┘

function setup() {
  frameRate(30);
  CANVAS = createCanvas(400, 400);
  CANVAS.mousePressed( () => {

    if (ACTION_MODIFICATION_TEXT_INPUT_ACTIVE) {
      ACTION_MODIFICATION_TEXT_INPUT.cleanup();
    }
  });
  
  initializeUI();
  MAIN_CHART = new Chart();
  
  // OSC = new p5.Oscillator('sine');
}
  
function draw() {

  background(220);

  displayControlsNotice();

  handleToolSelection();
  handleMovingObjects();
  
  handleClickAndDragFromNode();
  MAIN_CHART.visualize();
  handleToolVisualization();

  
}
