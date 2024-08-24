import Heap from 'heap-js';
import axios from 'axios';

export interface ApiRequest {
  id: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  url: string;
  payload?: any;
  scheduledTime: Date;
  retryCount?: number;
  maxTries?: number;
  userId?: string; // Added userId to track requests by user
}

class ApiScheduler {
  private heap: Heap<ApiRequest>;
  private nextTimeoutId: NodeJS.Timeout | null = null;
  private readonly retryDelay = 10000; // Retry delay for failed requests (10 seconds)
  private readonly maxTries = 5; // Maximum number of retry attempts
  private readonly batchSize = 50; // Number of emails per batch
  private readonly interval = 2000; // Interval between batches in milliseconds (2 seconds)
  private isProcessing = false;
  private totalRequests = 0;
  private userIds: Set<string> = new Set(); // Track user IDs with scheduled requests

  constructor() {
    this.heap = new Heap<ApiRequest>((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    this.userIds = new Set();
  }

  scheduleRequest(request: ApiRequest) {
    this.heap.push({
      ...request,
      retryCount: request.retryCount ?? 0,
      maxTries: request.maxTries ?? this.maxTries
    });

    if (request.userId) {
      this.userIds.add(request.userId);
    }

    this.totalRequests++;
    if (!this.isProcessing) {
      this.scheduleNextRequest();
    }
  }

  private scheduleNextRequest() {
    if (this.nextTimeoutId) {
      clearTimeout(this.nextTimeoutId);
    }

    const nextRequest = this.heap.peek();
    if (!nextRequest) return;

    const now = Date.now();
    const delay = Math.max(0, nextRequest.scheduledTime.getTime() - now);

    this.nextTimeoutId = setTimeout(() => this.processRequests(), delay);
  }

  private async processRequests() {
    this.isProcessing = true;
    const now = Date.now();

    while (this.heap.size() > 0 && this.heap.peek()!.scheduledTime.getTime() <= now) {
      const request = this.heap.pop();
      if (request) {
        await this.executeRequest(request);
      }
    }

    this.isProcessing = false;
    this.scheduleNextRequest();
  }

  private async executeRequest(request: ApiRequest) {
    try {
      const requestTime = new Date();
      console.log('Processed at:', requestTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

      const response = await axios({
        method: request.method.toLowerCase(),
        url: request.url,
        data: request.payload
      });

      console.log(`Request ${request.id} executed successfully. Status: ${response.status}`);
      this.totalRequests--;
      console.log(`Remaining requests: ${this.totalRequests}`);

      return response.data;
    } catch (error) {
      console.error(`Failed to execute request ${request.id}:`, error);
      await this.retryRequest(request);
    }
  }

  private async retryRequest(request: ApiRequest) {
    if ((request.retryCount ?? 0) >= (request.maxTries ?? this.maxTries)) {
      console.error(`Max retry attempts reached for request ${request.id}`);
      this.totalRequests--;
      console.log(`Remaining requests: ${this.totalRequests}`);
      return;
    }

    const retryRequest = {
      ...request,
      scheduledTime: new Date(Date.now() + this.retryDelay),
      retryCount: (request.retryCount ?? 0) + 1
    };

    this.scheduleRequest(retryRequest);
  }

  getScheduledRequestsCount(): number {
    return this.totalRequests;
  }


  isUserAlreadyScheduled(userId: string): boolean {
    return this.userIds.has(userId);
  }
  

  removeUserId(userId: string) {
    this.userIds.delete(userId);
  }
}

export const scheduler = new ApiScheduler();
