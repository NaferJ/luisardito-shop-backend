const {
  parseModeratorCommand,
} = require("../../src/services/kickModeratorCommands.service");

// Characterization test for parseModeratorCommand (pure function:
// moderator chat command string -> { command, name, flags } | null | error object).
// These expected values were derived by tracing the ORIGINAL implementation in
// src/services/kickModeratorCommands.service.js (L56-137) BEFORE any refactor,
// to pin current behavior exactly, including quirks.

describe("parseModeratorCommand - characterization", () => {
  describe("non-command / invalid input", () => {
    test("returns null when first word is not a valid moderator command", () => {
      expect(parseModeratorCommand("hello world")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(parseModeratorCommand("")).toBeNull();
    });

    test("returns null for whitespace-only string", () => {
      expect(parseModeratorCommand("   ")).toBeNull();
    });

    test("returns null for a random exclamation word", () => {
      expect(parseModeratorCommand("!something hi")).toBeNull();
    });

    test("accepts command word case-insensitively (!ADDCMD)", () => {
      const result = parseModeratorCommand("!ADDCMD hi");
      expect(result.command).toBe("!addcmd");
      expect(result.name).toBe("hi");
    });
  });

  describe("valid command word but no name", () => {
    test.each(["!addcmd", "!editcmd", "!delcmd", "!cmdinfo"])(
      '"%s" alone -> error object',
      (cmd) => {
        expect(parseModeratorCommand(cmd)).toEqual({
          command: cmd,
          name: null,
          flags: {},
          error: "You must specify the command name",
        });
      }
    );

    test("command word with trailing whitespace only -> error object", () => {
      expect(parseModeratorCommand("!addcmd   ")).toEqual({
        command: "!addcmd",
        name: null,
        flags: {},
        error: "You must specify the command name",
      });
    });

    test('name is just "!" -> stripped to empty -> error object', () => {
      expect(parseModeratorCommand("!addcmd !")).toEqual({
        command: "!addcmd",
        name: null,
        flags: {},
        error: "You must specify the command name",
      });
    });
  });

  describe("name normalization", () => {
    test("command name is lowercased and leading ! is stripped", () => {
      const result = parseModeratorCommand("!addcmd !Foo");
      expect(result.name).toBe("foo");
    });

    test("command name without ! is lowercased", () => {
      const result = parseModeratorCommand("!addcmd BarBaz");
      expect(result.name).toBe("barbaz");
    });

    test("returns { command, name, flags: {} } with no extra args", () => {
      expect(parseModeratorCommand("!addcmd hi")).toEqual({
        command: "!addcmd",
        name: "hi",
        flags: {},
      });
    });
  });

  describe("loose response words (no --response flag)", () => {
    test("loose words are joined into flags.response", () => {
      const result = parseModeratorCommand("!addcmd hi hello world");
      expect(result.flags.response).toBe("hello world");
    });

    test("single loose word becomes flags.response", () => {
      const result = parseModeratorCommand("!addcmd hi hello");
      expect(result.flags.response).toBe("hello");
    });
  });

  describe("--response flag precedence", () => {
    test("--response takes precedence over loose words before it", () => {
      const result = parseModeratorCommand("!addcmd hi hello --response world");
      expect(result.flags.response).toBe("world");
    });

    test("--response takes precedence over loose words after it", () => {
      const result = parseModeratorCommand("!addcmd hi --response world hello");
      // "hello" is collected into responseWords but does NOT overwrite flags.response
      expect(result.flags.response).toBe("world");
    });

    test("--response with quoted value", () => {
      const result = parseModeratorCommand(
        '!addcmd hi --response "some long response"'
      );
      expect(result.flags.response).toBe("some long response");
    });

    test("--response at end with no value -> empty string, loose words overwrite (quirk)", () => {
      // flags.response is set to "" (falsy), so the loose-word fallback triggers.
      const result = parseModeratorCommand("!addcmd hi hello --response");
      expect(result.flags.response).toBe("hello");
    });

    test("--response at end with no value and no loose words -> empty string", () => {
      const result = parseModeratorCommand("!addcmd hi --response");
      expect(result.flags.response).toBe("");
    });
  });

  describe("quoted multi-word values", () => {
    test('--desc "some long description" -> flags.desc === "some long description"', () => {
      const result = parseModeratorCommand(
        '!addcmd hi --desc "some long description"'
      );
      expect(result.flags.desc).toBe("some long description");
    });

    test("unclosed quote consumes remaining words", () => {
      const result = parseModeratorCommand('!addcmd hi --desc "unclosed');
      expect(result.flags.desc).toBe("unclosed");
    });

    test("quoted value with only one word", () => {
      const result = parseModeratorCommand('!addcmd hi --desc "word"');
      expect(result.flags.desc).toBe("word");
    });
  });

  describe("--aliases normalization", () => {
    test("aliases are trimmed, lowercased, leading ! stripped, empties filtered", () => {
      const result = parseModeratorCommand("!addcmd hi --aliases a,b,!C");
      expect(result.flags.aliases).toEqual(["a", "b", "c"]);
    });

    test("aliases value is a single token; spaces split the list (quirk)", () => {
      // parts split on whitespace, so "--aliases  a , b , c" captures only "a"
      // as the flag value; the rest become loose response words.
      const result = parseModeratorCommand("!addcmd hi --aliases  a , b , c");
      expect(result.flags.aliases).toEqual(["a"]);
      expect(result.flags.response).toBe(", b , c");
    });

    test("aliases with internal spaces inside a quoted value are trimmed", () => {
      // Opening quote must be attached to first char for the quoted-value parser.
      const result = parseModeratorCommand('!addcmd hi --aliases "a , b , c"');
      expect(result.flags.aliases).toEqual(["a", "b", "c"]);
    });

    test("aliases with empty entries are filtered out", () => {
      const result = parseModeratorCommand("!addcmd hi --aliases a,,b,");
      expect(result.flags.aliases).toEqual(["a", "b"]);
    });

    test("--aliases at end with no value -> empty array", () => {
      const result = parseModeratorCommand("!addcmd hi --aliases");
      expect(result.flags.aliases).toEqual([]);
    });
  });

  describe("--cooldown parsing", () => {
    test("--cooldown 5 -> flags.cooldown === 5", () => {
      const result = parseModeratorCommand("!addcmd hi --cooldown 5");
      expect(result.flags.cooldown).toBe(5);
    });

    test("--cooldown notanumber -> falls back to 3", () => {
      const result = parseModeratorCommand("!addcmd hi --cooldown notanumber");
      expect(result.flags.cooldown).toBe(3);
    });

    test("--cooldown at end with no value -> falls back to 3", () => {
      const result = parseModeratorCommand("!addcmd hi --cooldown");
      expect(result.flags.cooldown).toBe(3);
    });

    test("--cooldown 0 -> 0 is falsy, falls back to 3", () => {
      const result = parseModeratorCommand("!addcmd hi --cooldown 0");
      expect(result.flags.cooldown).toBe(3);
    });
  });

  describe("unknown flags", () => {
    test("unknown flag value is consumed but not added to flags", () => {
      const result = parseModeratorCommand("!addcmd hi --bogus x");
      expect(result.flags).not.toHaveProperty("bogus");
      expect(result.flags).toEqual({});
    });

    test("unknown flag at end with no value is consumed", () => {
      const result = parseModeratorCommand("!addcmd hi --bogus");
      expect(result.flags).not.toHaveProperty("bogus");
    });
  });

  describe("multiple flags combined", () => {
    test("all recognized flags together", () => {
      const result = parseModeratorCommand(
        '!addcmd hi hello --aliases a,b --cooldown 10 --desc "my desc"'
      );
      expect(result).toEqual({
        command: "!addcmd",
        name: "hi",
        flags: {
          response: "hello",
          aliases: ["a", "b"],
          cooldown: 10,
          desc: "my desc",
        },
      });
    });

    test("--response overrides loose words with other flags present", () => {
      const result = parseModeratorCommand(
        '!addcmd hi loose --response "real" --cooldown 5'
      );
      expect(result.flags.response).toBe("real");
      expect(result.flags.cooldown).toBe(5);
    });
  });

  describe("flag at very end with no following value", () => {
    test("--desc at end -> flags.desc === ''", () => {
      const result = parseModeratorCommand("!addcmd hi --desc");
      expect(result.flags.desc).toBe("");
    });
  });
});
