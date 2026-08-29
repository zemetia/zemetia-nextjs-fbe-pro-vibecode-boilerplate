export const REQUEST_BASE_PATH = '/admin/purchases/requests' as const;

export function requestListHref(): string {
  return REQUEST_BASE_PATH;
}

export function requestNewHref(): string {
  return `${REQUEST_BASE_PATH}/new`;
}

export function requestDetailHref(id: string): string {
  return `${REQUEST_BASE_PATH}/${id}`;
}

export function requestEditHref(id: string): string {
  return `${REQUEST_BASE_PATH}/${id}/edit`;
}
