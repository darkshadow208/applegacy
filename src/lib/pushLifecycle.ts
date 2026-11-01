// Sin dependencias de plataforma para poder probar carreras de registro/cierre de sesión.
export class PushLifecycle {
  private generation = 0;
  private userId: string | null = null;
  private token: string | null = null;
  private pending: Promise<void> = Promise.resolve();

  private readonly save: (token: string, platform: string) => Promise<void>;
  private readonly remove: (token: string) => Promise<void>;

  constructor(save: (token: string, platform: string) => Promise<void>, remove: (token: string) => Promise<void>) {
    this.save = save;
    this.remove = remove;
  }

  start(userId: string) {
    this.userId = userId;
    return ++this.generation;
  }

  isCurrent(generation: number) { return generation === this.generation && this.userId !== null; }

  bind(generation: number, token: string, platform: string): Promise<void> {
    if (!this.isCurrent(generation)) return Promise.resolve();
    // Conservar el token aun si falla la petición: un reintento de salida debe desvincularlo.
    this.token = token;
    const operation = this.pending.catch(() => {}).then(async () => {
      if (!this.isCurrent(generation)) return;
      await this.save(token, platform);
      if (!this.isCurrent(generation)) await this.remove(token);
    });
    this.pending = operation;
    return operation;
  }

  stop() { ++this.generation; this.userId = null; }

  async unlink(fallbackToken?: string | null) {
    this.stop();
    await this.pending.catch(() => {});
    const token = this.token ?? fallbackToken;
    if (token) await this.remove(token);
    this.token = null;
  }
}

let notificationSequence = 0;
export function nextNotificationId() {
  notificationSequence = (notificationSequence + 1) % 1000;
  // Rango positivo int32; reservar 1000..2999 para recordatorios existentes.
  return 3000 + ((Date.now() % 2_000_000) * 1000 + notificationSequence);
}
