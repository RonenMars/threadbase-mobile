import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { MessageBubble } from "@/components/conversation/MessageBubble";
import { dark } from "@/constants/theme";
import type { Message } from "@/types/api";

const mockHighlightRenders = { count: 0 };
jest.mock("prism-react-renderer", () => {
  const actual = jest.requireActual("prism-react-renderer");
  return {
    ...actual,
    Highlight: (props: object) => {
      mockHighlightRenders.count++;
      const ReactActual = jest.requireActual("react");
      return ReactActual.createElement(actual.Highlight, props);
    },
  };
});

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "msg-1",
  role: "user",
  content: [{ type: "text", text: "Hello!" }],
  timestamp: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("MessageBubble – text content", () => {
  it("renders user message text", async () => {
    const { getByText } = await render(<MessageBubble message={makeMessage()} />);
    expect(getByText("Hello!")).toBeTruthy();
  });

  it("renders assistant message text", async () => {
    const { getByText } = await render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: [{ type: "text", text: "How can I help?" }],
        })}
      />,
    );
    expect(getByText("How can I help?")).toBeTruthy();
  });

  it("renders token count when provided", async () => {
    const { getByText } = await render(
      <MessageBubble message={makeMessage({ tokens: 42 })} />,
    );
    expect(getByText("42 tokens")).toBeTruthy();
  });

  it("does not render token count when absent", async () => {
    const { queryByText } = await render(
      <MessageBubble message={makeMessage({ tokens: undefined })} />,
    );
    expect(queryByText(/tokens/)).toBeNull();
  });
});

describe("MessageBubble – code blocks", () => {
  it("renders code block with Copy button", async () => {
    const msgWithCode = makeMessage({
      content: [{ type: "text", text: '```\nconsole.log("hi")\n```' }],
    });
    const { getByText } = await render(<MessageBubble message={msgWithCode} />);
    expect(getByText("Copy")).toBeTruthy();
    expect(getByText("Code")).toBeTruthy();
  });

  it("does not re-run Prism when re-rendered with the same message", async () => {
    mockHighlightRenders.count = 0;
    const msgWithCode = makeMessage({
      content: [{ type: "text", text: "```js\nconst x = 1\n```" }],
    });

    const { rerender } = await render(<MessageBubble message={msgWithCode} />);
    expect(mockHighlightRenders.count).toBe(1);

    await rerender(<MessageBubble message={msgWithCode} />);
    await rerender(<MessageBubble message={msgWithCode} />);
    expect(mockHighlightRenders.count).toBe(1);
  });
});

describe("MessageBubble – tool_use", () => {
  it("renders tool use tag with emoji", async () => {
    const { getByText } = await render(
      <MessageBubble
        message={makeMessage({
          content: [
            { type: "tool_use", name: "Bash", input: { command: "ls" } },
          ],
        })}
      />,
    );
    expect(getByText("🔧 Bash")).toBeTruthy();
  });
});

describe("MessageBubble – search highlight", () => {
  it("wraps the matched needle in a styled nested Text, leaving surrounding text plain", async () => {
    const { getByText } = await render(
      <MessageBubble
        message={makeMessage({ content: [{ type: "text", text: "a wombat sighting" }] })}
        highlight="wombat"
      />,
    );
    const match = getByText("wombat");
    expect(match).toBeTruthy();
    expect(StyleSheet.flatten(match.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) }),
    );
  });

  it("matches case-insensitively", async () => {
    const { getByText } = await render(
      <MessageBubble
        message={makeMessage({ content: [{ type: "text", text: "a WOMBAT sighting" }] })}
        highlight="wombat"
      />,
    );
    expect(getByText("WOMBAT")).toBeTruthy();
  });

  it("wraps every occurrence within the same message", async () => {
    const { getAllByText } = await render(
      <MessageBubble
        message={makeMessage({ content: [{ type: "text", text: "wombat then another wombat" }] })}
        highlight="wombat"
      />,
    );
    expect(getAllByText("wombat").length).toBe(2);
  });

  it("renders plain text when no highlight prop is given (memo/perf regression guard)", async () => {
    const { getByText } = await render(<MessageBubble message={makeMessage()} />);
    const node = getByText("Hello!");
    // A single plain Text child — not split into multiple nested Text nodes.
    expect(node.children.length).toBe(1);
  });

  it("does not highlight when the needle is absent from the text", async () => {
    const { getByText, queryAllByText } = await render(
      <MessageBubble
        message={makeMessage({ content: [{ type: "text", text: "nothing to see here" }] })}
        highlight="wombat"
      />,
    );
    expect(getByText("nothing to see here")).toBeTruthy();
    expect(queryAllByText("wombat").length).toBe(0);
  });

  it("highlights the prose match while the fenced code block renders untouched", async () => {
    const { getByText, queryByText } = await render(
      <MessageBubble
        message={makeMessage({
          content: [{ type: "text", text: "a wombat above\n```\nplain code\n```" }],
        })}
        highlight="wombat"
      />,
    );
    // Prose match is wrapped in the accent match style.
    const match = getByText("wombat");
    expect(StyleSheet.flatten(match.props.style)).toEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) }),
    );
    // The CodeBlock still renders as normal — highlighting the prose part
    // doesn't reach into or disturb the fenced code renderer.
    expect(queryByText("Code")).toBeTruthy();
    expect(queryByText("Copy")).toBeTruthy();
  });

  it("does not treat a needle inside a fenced code block as a highlight target", async () => {
    const { getByText, queryAllByText } = await render(
      <MessageBubble
        message={makeMessage({
          content: [{ type: "text", text: "see below\n```\nwombat_var = 1\n```" }],
        })}
        highlight="wombat"
      />,
    );
    expect(getByText("see below")).toBeTruthy();
    // No node anywhere carries the highlight's exact match style with the
    // isolated needle text — the code renderer tokenizes the line as a whole,
    // never routing through highlightSegments.
    const highlighted = queryAllByText("wombat").filter(
      (n) => (StyleSheet.flatten(n.props.style) as { backgroundColor?: string } | undefined)?.backgroundColor,
    );
    expect(highlighted.length).toBe(0);
  });

  it("uses the same highlight fill for user and assistant matches", async () => {
    const user = await render(
      <MessageBubble
        message={makeMessage({ role: "user", content: [{ type: "text", text: "a wombat sighting" }] })}
        highlight="wombat"
      />,
    );
    const assistant = await render(
      <MessageBubble
        message={makeMessage({ role: "assistant", content: [{ type: "text", text: "a wombat sighting" }] })}
        highlight="wombat"
      />,
    );
    const userStyle = StyleSheet.flatten(user.getByText("wombat").props.style) as {
      backgroundColor?: string;
      color?: string;
    };
    const assistantStyle = StyleSheet.flatten(assistant.getByText("wombat").props.style) as {
      backgroundColor?: string;
      color?: string;
    };
    expect(userStyle.backgroundColor).toBe(assistantStyle.backgroundColor);
    expect(userStyle.color).toBe(assistantStyle.color);
    // A solid fill with a distinct text color, not a translucent tint.
    expect(userStyle.backgroundColor).toBe(dark.text.highlight);
    expect(userStyle.color).toBe(dark.text.onHighlight);
  });
});
