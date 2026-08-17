import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCalculatorExpression,
  getCalculatorCommandFromKeyboard,
  reduceCalculatorExpression,
} from "./rateCalculator.ts";

test("maps desktop number-row and numpad keys to calculator commands", () => {
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "7" }), {
    type: "input",
    value: "7",
  });
  assert.deepEqual(
    getCalculatorCommandFromKeyboard({ key: "7", code: "Numpad7" }),
    { type: "input", value: "7" },
  );
  assert.deepEqual(
    getCalculatorCommandFromKeyboard({ key: "Decimal", code: "NumpadDecimal" }),
    { type: "input", value: "." },
  );
});

test("normalizes physical keyboard operator aliases", () => {
  for (const key of ["*", "x", "X"]) {
    assert.deepEqual(getCalculatorCommandFromKeyboard({ key }), {
      type: "input",
      value: "×",
    });
  }
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "/" }), {
    type: "input",
    value: "÷",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "+" }), {
    type: "input",
    value: "+",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "-" }), {
    type: "input",
    value: "-",
  });
});

test("maps editing and completion keys to their intended actions", () => {
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "Backspace" }), {
    type: "backspace",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "c" }), {
    type: "clear",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "Delete" }), {
    type: "clear",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "=" }), {
    type: "equals",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "Enter" }), {
    type: "apply",
  });
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "Escape" }), {
    type: "close",
  });
});

test("does not intercept browser shortcuts, modified keys, or composition", () => {
  assert.equal(
    getCalculatorCommandFromKeyboard({ key: "c", metaKey: true }),
    null,
  );
  assert.equal(
    getCalculatorCommandFromKeyboard({ key: "7", ctrlKey: true }),
    null,
  );
  assert.equal(
    getCalculatorCommandFromKeyboard({ key: "/", altKey: true }),
    null,
  );
  assert.equal(
    getCalculatorCommandFromKeyboard({ key: "1", isComposing: true }),
    null,
  );
});

test("builds and calculates a complete rate expression from keyboard input", () => {
  const keys = ["4", "8", "0", "0", "0", "/", "3", "2"];
  const expression = keys.reduce((current, key) => {
    const command = getCalculatorCommandFromKeyboard({ key });
    assert.ok(command);
    return reduceCalculatorExpression(current, command);
  }, "");

  assert.equal(expression, "48000÷32");
  assert.equal(evaluateCalculatorExpression(expression), 1500);
  assert.deepEqual(getCalculatorCommandFromKeyboard({ key: "Enter" }), {
    type: "apply",
  });
});

test("shares equals, backspace, and clear behavior with on-screen controls", () => {
  assert.equal(
    reduceCalculatorExpression("12+3×4", { type: "equals" }),
    "24",
  );
  assert.equal(
    reduceCalculatorExpression("1500", { type: "backspace" }),
    "150",
  );
  assert.equal(reduceCalculatorExpression("150", { type: "clear" }), "");
});

test("keeps invalid or unsafe calculations from becoming usable results", () => {
  assert.equal(evaluateCalculatorExpression("10÷0"), null);
  assert.equal(evaluateCalculatorExpression("10+"), null);
  assert.equal(evaluateCalculatorExpression("2-5"), -3);
});
