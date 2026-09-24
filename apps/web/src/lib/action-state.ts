/** Тип состояния server action — общий для сервера и клиента. */
export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
}
