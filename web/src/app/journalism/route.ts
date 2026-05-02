import { NextResponse } from "next/server";

function journalismUrl(request: Request) {
  return new URL("/schools/journalism", request.url);
}

export function GET(request: Request) {
  return NextResponse.redirect(journalismUrl(request), 307);
}

export function HEAD(request: Request) {
  return NextResponse.redirect(journalismUrl(request), 307);
}
