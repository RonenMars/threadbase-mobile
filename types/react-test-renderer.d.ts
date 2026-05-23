// Minimal ambient module for tests. `@types/react-test-renderer` is not yet
// available for React 19 era at the time we wrote these tests. Tests use only
// `create()` and `toJSON()`, so a permissive shape is sufficient.
declare module 'react-test-renderer' {
  namespace renderer {
    interface ReactTestRendererJSON {
      type: string
      props: Record<string, unknown>
      children: null | (string | ReactTestRendererJSON)[]
    }

    interface ReactTestRenderer {
      toJSON(): ReactTestRendererJSON | ReactTestRendererJSON[] | null
      root: unknown
      unmount(): void
      update(element: React.ReactElement): void
    }

    interface ReactTestInstance {
      type: unknown
      props: Record<string, unknown>
      children: (ReactTestInstance | string)[]
      findAllByType(type: unknown): ReactTestInstance[]
    }

    function create(element: React.ReactElement): ReactTestRenderer
  }

  const renderer: {
    create(element: React.ReactElement): renderer.ReactTestRenderer
    act(callback: () => void | Promise<void>): void
  }

  export = renderer
}
