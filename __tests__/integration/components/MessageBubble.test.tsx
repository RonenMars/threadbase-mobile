import React from "react";
import { render } from "@testing-library/react-native";
import { MessageBubble } from "@/components/conversation/MessageBubble";
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
