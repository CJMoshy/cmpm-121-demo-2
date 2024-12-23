import "./style.css";

/** DOM SETUP */
const APP_NAME = "Paint '24";
document.title = APP_NAME;
const app = document.querySelector<HTMLDivElement>("#app")!;

const CANVAS_HEIGHT = 256;
const CANVAS_WIDTH = 256;

const title = document.createElement("h1");
title.textContent = "Paint '24";

const main_canvas = document.createElement("canvas");
main_canvas.width = CANVAS_WIDTH;
main_canvas.height = CANVAS_HEIGHT;
main_canvas.className = "main-canvas";

const clear_button = createHTMLElement("button", "clear-btn", "clear");
const export_button = createHTMLElement("button", "export-btn", "export");

const bottom_container = document.createElement("div");
bottom_container.append(clear_button);
bottom_container.append(export_button);

const undo_button = createHTMLElement("button", "undo-btn", "undo");
const redo_button = createHTMLElement("button", "redo-btn", "redo");

const undo_redo_container = document.createElement("div");
undo_redo_container.className = "undo-redo-container";
undo_redo_container.append(undo_button);
undo_redo_container.append(redo_button);

const set_thin_marker_button = createHTMLElement(
  "button",
  "thin-btn",
  `thin (1.5)`,
);
set_thin_marker_button.classList.add("current-marker");

const set_thick_marker_button = createHTMLElement(
  "button",
  "thick-btn",
  `thick (4.0)`,
);

const set_marker_slider = sliderCreate("marker-slider", "range", "1", "100");
const set_color_slider = sliderCreate("color-slider", "range", "1", "360");
const set_lightness_slider = sliderCreate(
  "lightness-slider",
  "range",
  "1",
  "100",
);

const txt = createHTMLElement("p", "slider-txt", "Custom Size");
const txt2 = createHTMLElement("p", "color-txt", "Custom Color");
const sampler_div = document.createElement("div");
sampler_div.className = "sampler-div";

const reset_color_button = createHTMLElement(
  "button",
  "reset-color-button",
  "reset color",
);

const marker_size_continer = document.createElement("div");
marker_size_continer.className = "marker-size-container";
marker_size_continer.textContent = "Marker Presets";
marker_size_continer.append(
  set_thin_marker_button,
  set_thick_marker_button,
  txt,
  set_marker_slider,
);
marker_size_continer.append(
  txt2,
  set_color_slider,
  set_lightness_slider,
  sampler_div,
);
marker_size_continer.append(reset_color_button);

const add_sticker_button = document.createElement("button");
add_sticker_button.textContent = "Add Sticker";

const cluster = document.createElement("div");
cluster.className = "remove-sticker-container";
const remove_sticker_input = document.createElement("input");
remove_sticker_input.className = "remove-sticker-input";
remove_sticker_input.type = "text";
remove_sticker_input.placeholder = "remove..";
const remove_sticker_button = document.createElement("button");
remove_sticker_button.textContent = "rm";
cluster.append(remove_sticker_input, remove_sticker_button);
const sticker_sidebar = document.createElement("div");
sticker_sidebar.className = "sticker-sidebar";
sticker_sidebar.textContent = "Stickers";
sticker_sidebar.append(add_sticker_button, cluster);

const canvas_container = document.createElement("div");
canvas_container.className = "canvas-container";

canvas_container.append(main_canvas, bottom_container, undo_redo_container);

const main_container = document.createElement("div");
main_container.className = "main-container";

main_container.append(marker_size_continer, canvas_container, sticker_sidebar);
app.append(title, main_container);

/** DRAWING LOGIC */
const current_line: LineCommand = {
  thickness: undefined,
  color: "black",
  points: [],
  grow: function (x, y) {
    this?.points.push({ x: x, y: y });
  },
  execute: function (ctx) {
    if (this.points.length === 0) return;
    const tmp = ctx?.lineWidth;
    const tmpC = ctx.strokeStyle;
    ctx!.lineWidth = this.thickness as number;
    ctx!.strokeStyle = this.color as string;
    const [{ x, y }, ...rest] = this?.points;
    ctx?.beginPath();
    ctx?.moveTo(x, y);
    for (const { x, y } of rest) {
      ctx?.lineTo(x, y);
    }
    ctx?.stroke();
    ctx!.lineWidth = tmp as number;
    ctx!.strokeStyle = tmpC;
  },
};

const current_sticker: StickerCommand = {
  cords: { x: 0, y: 0 },
  id: "",
  execute: function (ctx) {
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.font = "30px serif";
    ctx.fillText(this.id, this.cords.x, this.cords.y);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
  },
};

const pen: CursorCommand = {
  active: false,
  x: 0,
  y: 0,
  sticker: {
    cur: false,
    id: "",
  },
  execute: function (ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    if (!this.sticker.cur) {
      ctx.arc(this?.x, this?.y, ctx.lineWidth, 0, 2 * Math.PI);
    } else {
      ctx.font = "30px serif";
      ctx.fillStyle = "#000000";
      ctx.fillText(this.sticker.id, this.x, this.y);
    }
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
  },
};

const stickers: Sticker[] = ["👽", "👻", "🎃"];
const commands: Command[] = [];
const redo_stack: Command[] = [];

const export_scale_factor = 4;
const thin_line_width = 1.5;
const thick_line_width = 4;
const main_ctx = main_canvas.getContext("2d");
main_ctx!.fillStyle = "white";
main_ctx!.lineWidth = thin_line_width;

/**
 * @function
 * loads saved stickers from local storage
 * if stickers exist, they are added to the
 * sticker_sidebar element.
 */
const load_stickers = () => {
  const saved = localStorage.getItem("stickers");
  if (saved) {
    const parsed = JSON.parse(saved);
    for (const p of parsed) {
      stickers.push(p);
    }
  }

  for (const s of stickers) {
    const sticker = document.createElement("button");
    sticker.textContent = s;
    sticker.id = s;
    sticker.addEventListener("click", () => sticker_clicked(sticker));
    sticker_sidebar.append(sticker);
  }
};

/**
 * @function
 * handles deletion logic for a given sticker.
 * removes the sticker from the array of stickers
 * and its associated button element in the dom
 */
const delete_sticker = () => {
  const input = document.querySelector(
    ".remove-sticker-input",
  ) as HTMLInputElement;
  if (!input.value) return;

  const rm_sticker_index = stickers.findIndex((e) => e === input.value);
  if (rm_sticker_index === -1) return;

  stickers.splice(rm_sticker_index, 1);
  sticker_sidebar.removeChild(
    document.querySelector(`#${input.value}`) as HTMLButtonElement,
  );
  const saved = localStorage.getItem("stickers");
  if (!saved) return;

  const parsed = JSON.parse(saved);
  const rm_saved_index = parsed.findIndex((e: string) => e === input.value);
  if (rm_saved_index === -1) return;

  parsed.splice(rm_saved_index, 1);
  localStorage.setItem("stickers", JSON.stringify(parsed));
};

/**
 * @function
 * saves the sticker array to local storage
 * creates new allocation if not alreay in local storage
 * @param sticker stickers are strings lol
 */
const save_to_local_storage = (sticker: Sticker) => {
  const saved = localStorage.getItem("stickers");
  if (!saved) {
    const saved_stickers = [sticker];
    localStorage.setItem("stickers", JSON.stringify(saved_stickers));
  } else {
    const parsed = JSON.parse(saved);
    parsed.push(sticker);
    localStorage.setItem("stickers", JSON.stringify(parsed));
  }
};

/**
 * @function
 * this is responsible for exporting the drawings made by the user
 */
const handle_export = () => {
  const { export_ctx, export_canvas } = get_export_ctx_and_canvas();
  draw(export_ctx as CanvasRenderingContext2D, export_canvas);
  const anchor = document.createElement("a");
  anchor.href = export_canvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
};

/**
 * @function
 * helper function for the expoert method that creates the new canvas
 * and associated rendering context.
 */
const get_export_ctx_and_canvas = () => {
  const export_canvas = document.createElement("canvas");
  export_canvas.width = 1024;
  export_canvas.height = 1024;
  const export_ctx = export_canvas.getContext("2d");
  export_ctx!.fillStyle = "white";
  export_ctx?.scale(export_scale_factor, export_scale_factor);
  export_ctx?.fillRect(0, 0, export_canvas.width, export_canvas.height);
  return { export_ctx, export_canvas };
};

/**
 * @function
 * Add a sticker to both the sticker array and the dom
 * also saves to localstorage for persistance across sessions.
 */
const add_sticker: AddStickerCommand = () => {
  const new_sticker = prompt("Add a sticker here", "") as string;
  if (new_sticker === undefined) return;
  if (new_sticker === "") return;

  stickers.push(new_sticker);
  save_to_local_storage(new_sticker);
  const new_sticker_button = document.createElement("button");
  new_sticker_button.id = new_sticker;
  new_sticker_button.addEventListener(
    "click",
    () => {
      sticker_clicked(new_sticker_button);
    },
  );
  new_sticker_button.textContent = new_sticker;
  sticker_sidebar.append(new_sticker_button);
};

/**
 * @function
 * helper for clicking on a sticker that deals with CSS classes.
 * More importantly, it sets the drawing tool to the sticker
 * @param s
 */
const sticker_clicked = (s: HTMLButtonElement) => {
  document.querySelector(".current-marker")?.classList.remove("current-marker");
  document.querySelector(".current-sticker")?.classList.remove(
    "current-sticker",
  );
  s.classList.add("current-sticker");
  pen.sticker.id = stickers[stickers.findIndex((e) => e === s.textContent)];
  pen.sticker.cur = true;
};

/**
 * @function
 * @param number
 * @command set marker width wrapper fn
 */
const set_marker_width: MarkerCommand = (width: number) => {
  main_ctx!.lineWidth = width;
};

/**
 * @function
 * helper to 'place' the sticker
 * pushes current sticker to commands array
 * to be drawn in the next cycle
 */
const place_sticker = () => {
  current_sticker.cords.x = pen.x;
  current_sticker.cords.y = pen.y;
  current_sticker.id = pen.sticker.id;
  commands.push({ ...current_sticker });
  current_sticker.cords = { x: 0, y: 0 };
  current_sticker.id = "";
};

/**
 * @function
 * helper for clicking on canvas that will delegate work
 * to either sticker engine or line engine
 */
const mouse_clicked_on_canvas = () => {
  if (pen.sticker.cur) place_sticker();
  else {
    current_line.thickness = main_ctx?.lineWidth;
    pen.active = true;
  }
};

/**
 * @function
 * helper for finishing a line
 * saves lines or removes tooltip for
 * drawing tool from canvas
 */
const finish_line_handler = () => {
  if (!pen.active) {
    pen.x = NaN;
    pen.y = NaN;
  } else {
    commands.push({ ...current_line });
    current_line.points = [];
    pen.active = false;
  }
  main_canvas.dispatchEvent(new Event("drawing-changed"));
};

/**
 * @function
 * handle mouse movement over the canvas
 * @param e mouse event
 */
const handle_mouse_move = (e: MouseEvent) => {
  if (!pen.active) {
    main_canvas.dispatchEvent(new Event("tool-moved"));
  }
  pen.x = e.offsetX;
  pen.y = e.offsetY;
  log_point(e);
};

/**
 * @function
 * deals with toggling to thin marker
 * sets css properties
 * and calls helper to set line width
 */
const handle_thin_marker_toggle = () => {
  switchMarkerWidth("thin");
};

/**
 * @function
 * deals with toggling to thick maker
 * sets css properties
 * and calls helper to set line width
 */
const handle_thick_marker_toggle = () => {
  switchMarkerWidth("thick");
};

/**
 * @function
 * helper to set custom width on pen line based on input element drag
 */
const handle_marker_slider = () => {
  const val = document.getElementById("marker-slider") as HTMLInputElement;
  const parsed = parseInt(val.value) / 25; // largest size allowed is 4
  set_marker_width(parsed);
  document.querySelector(".slider-txt")!.textContent =
    `Custom Size -> ${parsed}`;
};

/**
 * @function
 * gets current slider value from color slider
 * sets the color to the current drawing line
 */
const handle_color_slider = () => {
  const val = document.getElementById("color-slider") as HTMLInputElement;
  const lightVal = document.getElementById(
    "lightness-slider",
  ) as HTMLInputElement;
  const hue = Number(val.value);
  const lightness = Number(lightVal.value);
  current_line.color = `hsl(${hue}, 100%, ${lightness}%)`;
  const color_preview = document.querySelector(
    ".sampler-div",
  ) as HTMLDivElement;
  color_preview.style.backgroundColor = `hsl(${hue}, 100%, ${lightness}%)`;
};

/**
 * @function
 * helper that resets the drawing color to black
 */
const reset_color = () => {
  const color_preview = document.querySelector(
    ".sampler-div",
  ) as HTMLDivElement;
  color_preview.style.backgroundColor = "black";
  current_line.color = "black";
};

/**
 * @function
 * handles undo and redo logic
 * @param undo boolean representing wich command to execute
 */
const handle_undo_redo: UndoRedoCommand = (undo: boolean) => {
  if (undo && commands.length === 0) return;
  if (!undo && redo_stack.length === 0) return;
  if (undo) redo_stack.push(commands.pop() as LineCommand);
  else commands.push(redo_stack.pop() as LineCommand);
  main_canvas.dispatchEvent(new Event("drawing-changed"));
};

/**
 * @function
 * log the current point the pen is at if in drawing state
 * @param e MouseEvent
 */
const log_point = (e: MouseEvent) => {
  if (!pen.active) return;
  current_line.grow(e.offsetX, e.offsetY);
  main_canvas.dispatchEvent(new Event("drawing-changed"));
};

/**
 * @function
 * helper to wipe the canvas.
 * Also clears commands array, removing any previously drawn elements
 * local storage is not affected
 */
const clear_canvas = () => {
  main_ctx?.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  current_line.points = [];
  commands.length = 0;
  redo_stack.length = 0;
};

/**
 * @function
 * this is the main rendering function for the application.
 * it delegates work to any active commands and
 * @param ctx rendering context from canvas
 * @param canvas html canvas element
 */
const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  commands.forEach((e) => e.execute(ctx));
  current_line.execute(ctx);
  pen.execute(ctx);
};

/** REGISTER EVENTS TO THE CANVAS */
main_canvas.addEventListener("mousedown", mouse_clicked_on_canvas);
main_canvas.addEventListener("mouseup", finish_line_handler);
main_canvas.addEventListener("mouseleave", finish_line_handler);
main_canvas.addEventListener("mousemove", (e) => {
  handle_mouse_move(e);
});
main_canvas.addEventListener(
  "drawing-changed",
  () => draw(main_ctx as CanvasRenderingContext2D, main_canvas),
);
main_canvas.addEventListener(
  "tool-moved",
  () => draw(main_ctx as CanvasRenderingContext2D, main_canvas),
);

function switchMarkerWidth(width: string) {
  pen.sticker.cur = false;
  document.querySelector(".current-sticker")?.classList.remove(
    "current-sticker",
  );
  set_thin_marker_button.classList.remove("current-marker");
  set_thick_marker_button.classList.add("current-marker");
  if (width == "thick") {
    set_marker_width(thick_line_width);
  } else if (width == "thin") {
    set_marker_width(thin_line_width);
  }
}

/** HTML Element Creators */
function createHTMLElement(
  element: string,
  className: string,
  textContent: string,
) {
  const newButton = document.createElement(element);
  newButton.className = className;
  newButton.textContent = textContent;
  return newButton;
}

function sliderCreate(
  id: string,
  type: string,
  min: string,
  max: string,
): HTMLInputElement {
  const newInput = document.createElement("input");
  newInput.id = id;
  newInput.type = type;
  newInput.min = min;
  newInput.max = max;
  return newInput;
}

/** REGISTER EVENTS FOR BUTTONS */
// Helper function to add event listeners
function attachEventListeners(eventConfig: ButtonEventConfig[]) {
  eventConfig.forEach(({ element, eventType, handler }) => {
    element.addEventListener(eventType, handler);
  });
}

const buttonEvents: ButtonEventConfig[] = [
  { element: export_button, eventType: "click", handler: handle_export },
  { element: clear_button, eventType: "click", handler: clear_canvas },
  {
    element: undo_button,
    eventType: "click",
    handler: () => handle_undo_redo(true),
  },
  {
    element: redo_button,
    eventType: "click",
    handler: () => handle_undo_redo(false),
  },
  {
    element: set_thin_marker_button,
    eventType: "click",
    handler: handle_thin_marker_toggle,
  },
  {
    element: set_thick_marker_button,
    eventType: "click",
    handler: handle_thick_marker_toggle,
  },
  {
    element: set_marker_slider,
    eventType: "input",
    handler: handle_marker_slider,
  },
  {
    element: set_color_slider,
    eventType: "input",
    handler: handle_color_slider,
  },
  {
    element: set_lightness_slider,
    eventType: "input",
    handler: handle_color_slider,
  },
  { element: reset_color_button, eventType: "click", handler: reset_color },
  { element: add_sticker_button, eventType: "click", handler: add_sticker },
  {
    element: remove_sticker_button,
    eventType: "click",
    handler: delete_sticker,
  },
];

attachEventListeners(buttonEvents);

/** LOAD STICKERS FROM STORAGE */
document.addEventListener("DOMContentLoaded", load_stickers);
