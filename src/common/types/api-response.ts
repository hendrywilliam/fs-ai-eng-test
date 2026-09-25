export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data, error: null };
}
