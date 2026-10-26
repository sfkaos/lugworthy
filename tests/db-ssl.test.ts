import { describe, expect, it } from "vitest";
import { withSsl } from "../lib/db/ssl";

describe("withSsl", () => {
  it("asks for TLS on hosted databases", () => {
    expect(withSsl("postgresql://u:p@dpg-x.virginia-postgres.render.com/db")).toBe(
      "postgresql://u:p@dpg-x.virginia-postgres.render.com/db?sslmode=require",
    );
    expect(withSsl("postgres://u:p@h.example.com/db?application_name=a")).toBe(
      "postgres://u:p@h.example.com/db?application_name=a&sslmode=require",
    );
  });
  it("keeps an explicit sslmode", () => {
    expect(withSsl("postgres://u:p@h.example.com/db?sslmode=disable")).toBe("postgres://u:p@h.example.com/db?sslmode=disable");
  });
  it("leaves local databases alone", () => {
    expect(withSsl("postgres://u:p@localhost:5432/db")).toBe("postgres://u:p@localhost:5432/db");
    expect(withSsl("postgres://u:p@127.0.0.1/db")).toBe("postgres://u:p@127.0.0.1/db");
  });
});
