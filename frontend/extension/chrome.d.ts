declare namespace chrome {
  namespace runtime {
    type Port = {
      name?: string;
      onDisconnect: {
        addListener(callback: () => void): void;
      };
    };

    function connect(connectInfo?: { name?: string }): Port;
    function sendMessage(message: unknown): Promise<unknown>;

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };

    const onConnect: {
      addListener(callback: (port: Port) => void): void;
    };
  }

  namespace tabs {
    function create(createProperties: { url: string }): Promise<unknown>;
  }

  namespace storage {
    namespace local {
      function get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      function set(items: Record<string, unknown>): Promise<void>;
      function remove(keys: string | string[]): Promise<void>;
    }
  }
}
