"use strict";
function setTimeout() {
   throw new Error("setTimeout called")
}
function importScripts() {
  // ignore
}
function postMessage() {
  // ignore
}
if (typeof console == "undefined")
  console = {}
if (!console.log)
  console.log = print
