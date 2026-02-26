import { ACCESS_TOKEN_KEY, ADDRESS_KEY, WEB_APP_DATA_KEY } from '@src/lib/storageKeys';
import { store } from '@src/store';
import { setIsLogin } from '@src/store/slices/userSlice';

export interface StreamingRequestOptions {
  delimiter?: string;
  parseMode?: 'json' | 'ndjson' | 'sse';
  abortController?: AbortController;
  endFun?: () => void;
  forceDirect?: boolean;
}

export interface SSEMessageEvent {
  event: 'message' | 'workflow_started' | 'workflow_finished' | 'message_end';
  answer?: string;
  [key: string]: unknown;
}

export async function* streamingRequest<TResponse = SSEMessageEvent>(
  url: string,
  config: RequestInit = {},
  options: StreamingRequestOptions = {},
): AsyncGenerator<TResponse> {
  console.log('streamingRequest called:', { url, config, options });
  const controller = options.abortController || new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  config.signal = controller.signal;
  const urlObj = new URL(url, window.location.origin);

  const access_token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  const address = window.localStorage.getItem(ADDRESS_KEY);
  const webAppData = window.localStorage.getItem(WEB_APP_DATA_KEY);

  if (access_token && address) {
    if (!config.headers) {
      config.headers = new Headers();
    }
    if (!(config.headers instanceof Headers)) {
      config.headers = new Headers(config.headers);
    }
    (config.headers as Headers).set('Source', '1');
    (config.headers as Headers).set('Authorization', `Bearer ${access_token}`);
    (config.headers as Headers).set('Address', address);
    (config.headers as Headers).set('Web-App-Data', webAppData || '');
  }

  // Add cache prevention headers
  if (!config.headers) {
    config.headers = new Headers();
  }
  if (!(config.headers instanceof Headers)) {
    config.headers = new Headers(config.headers);
  }

  (config.headers as Headers).set('Cache-Control', 'no-cache, no-store, must-revalidate');
  (config.headers as Headers).set('Pragma', 'no-cache');
  (config.headers as Headers).set('Expires', '0');
  (config.headers as Headers).set('X-Accel-Buffering', 'no');
  (config.headers as Headers).set('Accept', 'text/event-stream');

  // Add anti-cache timestamp
  urlObj.searchParams.set('_t', Date.now().toString());
  const finalUrl = urlObj.toString();

  try {
    const isMixedContent = urlObj.protocol === 'http:' && window.location.protocol === 'https:';
    if (isMixedContent && !options.forceDirect && chrome?.runtime?.sendMessage) {
      console.log('Mixed content detected, using background proxy fetch:', finalUrl);
      const headersObj: Record<string, string> = {};
      if (config.headers instanceof Headers) {
        config.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
      } else if (config.headers) {
        Object.assign(headersObj, config.headers as Record<string, string>);
      }

      const proxyResponse = await new Promise<{
        ok: boolean;
        status?: number;
        statusText?: string;
        headers?: Record<string, string>;
        data?: string;
        error?: string;
      }>((resolve, reject) => {
        const proxyTimeout = setTimeout(() => reject(new DOMException('Request aborted', 'AbortError')), 60000);
        chrome.runtime.sendMessage(
          {
            type: 'PROXY_FETCH',
            url: finalUrl,
            method: config.method || 'GET',
            headers: headersObj,
            body: config.body,
          },
          response => {
            clearTimeout(proxyTimeout);
            resolve(response);
          },
        );
      });

      clearTimeout(timeoutId);

      if (!proxyResponse?.ok) {
        const errorText = proxyResponse?.data || proxyResponse?.error || proxyResponse?.statusText || '';
        let errorData: { code?: number; message?: string } | null = null;
        try {
          errorData = errorText ? (JSON.parse(errorText) as { code?: number; message?: string }) : null;
        } catch {
          errorData = null;
        }
        if (errorData?.code === 401 || proxyResponse?.status === 401) {
          store.dispatch(setIsLogin(false));
          window.dispatchEvent(new Event('unauthorized'));
          throw new Error(errorData?.message || 'Unauthorized');
        }
        throw new Error(errorData?.message || errorText || 'Request failed');
      }

      const proxyText = proxyResponse?.data || '';
      if (!proxyText) {
        throw new Error('No response body');
      }

      const contentType = proxyResponse?.headers?.['content-type'];
      const isSSE = contentType?.includes('text/event-stream') || options.parseMode === 'sse';
      let buffer = proxyText;

      if (isSSE) {
        while (buffer.includes('\n\n')) {
          const eventEndIndex = buffer.indexOf('\n\n');
          const event = buffer.slice(0, eventEndIndex);
          buffer = buffer.slice(eventEndIndex + 2);

          if (event.trim()) {
            const lines = event.split('\n');
            let eventData = '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                const dataContent = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
                eventData += dataContent;
              }
            }

            if (eventData.trim()) {
              try {
                const parsedData = JSON.parse(eventData.trim()) as SSEMessageEvent;
                if (parsedData.event === 'message' && parsedData.answer !== undefined) {
                  yield parsedData as TResponse;
                } else if (
                  parsedData.event === 'workflow_started' ||
                  parsedData.event === 'workflow_finished' ||
                  parsedData.event === 'message_end'
                ) {
                  yield parsedData as TResponse;
                  options.endFun?.();
                }
              } catch (e) {
                console.warn('JSON parse failed:', eventData, e);
                yield eventData as TResponse;
              }
            }
          }
        }
      } else {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              yield data as TResponse;
            } catch (e) {
              console.warn('Failed to parse JSON line:', line, e);
            }
          }
        }
      }
    } else {
      console.log('Fetching:', finalUrl);
      const response = await fetch(finalUrl, config);
      console.log('Response received:', response.status, response.statusText);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: { code?: number; message?: string } | null = null;
        try {
          errorData = errorText ? (JSON.parse(errorText) as { code?: number; message?: string }) : null;
        } catch {
          errorData = null;
        }
        if (errorData?.code === 401 || response.status === 401) {
          store.dispatch(setIsLogin(false));
          window.dispatchEvent(new Event('unauthorized'));
          throw new Error(errorData?.message || 'Unauthorized');
        } else if (errorData?.code !== 0 && errorText) {
          throw new Error(errorData?.message || errorText || 'Request failed');
        }
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const contentType = response.headers.get('content-type');
      const isSSE = contentType?.includes('text/event-stream') || options.parseMode === 'sse';

      console.log('Starting stream read...', { contentType, isSSE });
      let chunkCount = 0;

      while (true) {
        // Check if request is aborted
        if (controller.signal.aborted) {
          console.log('Stream request aborted');
          throw new DOMException('Request aborted', 'AbortError');
        }

        const { done, value } = await reader.read();

        if (done) {
          console.log('Stream read complete');
          break;
        }

        chunkCount++;
        const chunk = decoder.decode(value, { stream: true });
        console.log(`Chunk #${chunkCount}:`, chunk.length, 'bytes', 'timestamp:', Date.now());
        console.log(`Chunk preview:`, chunk.substring(0, 200));

        buffer += chunk;

        if (isSSE) {
          // Process each complete SSE event in real-time
          while (buffer.includes('\n\n')) {
            // Check again if request is aborted
            if (controller.signal.aborted) {
              console.log('SSE processing aborted');
              throw new DOMException('Request aborted', 'AbortError');
            }

            const eventEndIndex = buffer.indexOf('\n\n');
            const event = buffer.slice(0, eventEndIndex);
            buffer = buffer.slice(eventEndIndex + 2);

            if (event.trim()) {
              console.log('Processing event:', event.substring(0, 100) + '...');
              const lines = event.split('\n');
              let eventData = '';

              for (const line of lines) {
                if (line.startsWith('data:')) {
                  // Extract content after 'data:', with or without space
                  const dataContent = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
                  console.log('Extracted data line:', JSON.stringify(line));
                  console.log('Data content:', JSON.stringify(dataContent));
                  eventData += dataContent;
                }
              }

              console.log('Complete eventData:', JSON.stringify(eventData));
              console.log('eventData length:', eventData.length);

              if (eventData.trim()) {
                try {
                  eventData = eventData.trim();
                  console.log('Parsing eventData:', JSON.stringify(eventData));
                  console.log('eventData length:', eventData.length);
                  const parsedData = JSON.parse(eventData) as SSEMessageEvent;
                  console.log('Parsed SSE data:', parsedData);

                  // Check if it's a message event and extract answer field
                  if (parsedData.event === 'message' && parsedData.answer !== undefined) {
                    console.log('Yielding message content:', parsedData.answer);
                    yield parsedData as TResponse;
                    console.log('Yield message content complete');
                  } else if (
                    parsedData.event === 'workflow_started' ||
                    parsedData.event === 'workflow_finished' ||
                    parsedData.event === 'message_end'
                  ) {
                    // Also yield workflow events for frontend state handling
                    console.log('Yielding workflow event:', parsedData.event);
                    yield parsedData as TResponse;
                    console.log('Yield workflow event complete');
                    options.endFun?.();
                  }
                } catch (e) {
                  console.warn('JSON parse failed:', eventData, e);
                  yield eventData as TResponse;
                }
              }
            }
          }
        } else {
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
                console.log('Parsed NDJSON data:', data);
                yield data as TResponse;
              } catch (e) {
                console.warn('Failed to parse JSON line:', line, e);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('streamingRequest error:', error);
    clearTimeout(timeoutId);
    throw error;
  }
}
