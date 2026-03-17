declare module 'update-notifier' {
  interface PackageDescriptor {
    readonly name: string;
    readonly version: string;
  }

  interface UpdateNotifierOptions {
    readonly pkg: PackageDescriptor;
  }

  interface UpdateNotifierInstance {
    notify(): void;
  }

  export default function updateNotifier(options: UpdateNotifierOptions): UpdateNotifierInstance;
}
