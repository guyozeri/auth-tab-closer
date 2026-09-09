"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluate } = require("../src/rules.js");

// Text roughly as it appears on the screenshots the project was built from.
const TELEPORT = `Teleport
Login Successful
You have successfully signed into your account.
You can close this window and continue using the product.`;

const CURSOR = `Authorization complete!
You can close this tab and return to Cursor.
Return to Cursor`;

test("Teleport 'Login Successful' page matches (provider + strong phrase)", () => {
  const v = evaluate({ text: TELEPORT, title: "Teleport", host: "teleport.example.com" });
  assert.equal(v.match, true);
  assert.equal(v.score, 3);
});

test("Cursor 'Authorization complete!' page matches", () => {
  const v = evaluate({ text: CURSOR, title: "", host: "cursor.com" });
  assert.equal(v.match, true);
  assert.equal(v.score, 3);
});

test("generic 'you can close this window' on any host matches", () => {
  const v = evaluate({
    text: "All done. You can close this window now.",
    host: "auth.some-tool.io",
  });
  assert.equal(v.match, true);
  assert.equal(v.score, 3);
});

test("Google loopback verification-code page matches", () => {
  const v = evaluate({
    text: "Received verification code. You may now close this window.",
    host: "localhost",
  });
  assert.equal(v.match, true);
});

test("weak phrase on a SPARSE page matches with score 2", () => {
  const v = evaluate({ text: "Login successful", host: "app.example.com" });
  assert.equal(v.match, true);
  assert.equal(v.score, 2);
});

test("weak phrase on a CONTENT-HEAVY page does NOT match", () => {
  const filler = "This is your dashboard. ".repeat(40); // > SPARSE_PAGE_MAX_CHARS
  const v = evaluate({
    text: "Login successful. Welcome back! " + filler,
    title: "Dashboard",
    host: "app.example.com",
  });
  assert.equal(v.match, false);
  assert.equal(v.score, 0);
});

test("ordinary page with no auth phrasing does not match", () => {
  const v = evaluate({
    text: "Ten tips for a better morning routine. Subscribe to our newsletter.",
    title: "Blog",
    host: "example.com",
  });
  assert.equal(v.match, false);
});

test("user-supplied extra strong phrase matches", () => {
  const v = evaluate({
    text: "You can return to your terminal.",
    host: "example.com",
    extraStrongPhrases: ["you can return to your terminal"],
  });
  assert.equal(v.match, true);
  assert.equal(v.score, 3);
});

test("empty page does not throw and does not match", () => {
  const v = evaluate({ text: "", title: "", host: "" });
  assert.equal(v.match, false);
});

test("matching is case-insensitive and whitespace-tolerant", () => {
  const v = evaluate({ text: "  YOU   CAN\n\nCLOSE   THIS   TAB  ", host: "x.io" });
  assert.equal(v.match, true);
});
