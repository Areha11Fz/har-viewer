export interface HarEntry {
  _id: string;
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    queryString: Array<{ name: string; value: string }>;
    postData?: { mimeType: string; text?: string };
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
      encoding?: string;
    };
  };
}

export interface HarFile {
  log: {
    version: string;
    creator?: { name: string; version: string };
    entries: Array<{
      startedDateTime: string;
      time: number;
      request: {
        method: string;
        url: string;
        headers: Array<{ name: string; value: string }>;
        queryString: Array<{ name: string; value: string }>;
        postData?: { mimeType: string; text?: string };
      };
      response: {
        status: number;
        statusText: string;
        headers: Array<{ name: string; value: string }>;
        content: {
          size: number;
          mimeType: string;
          text?: string;
          encoding?: string;
        };
      };
    }>;
  };
}
