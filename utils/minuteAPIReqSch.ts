import Heap from 'heap-js';
import axios from 'axios';

export interface ApiRequest {
  id: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  url: string;
  payload?: any;
  retryCount?: number;
  maxTries?: number;
}

class ApiScheduler {
  private heap: Heap<ApiRequest>;
  private readonly retryDelay = 10000; // Retry delay for failed requests (10 seconds)
  private readonly maxTries = 5; // Maximum number of retry attempts
  private isProcessing = false;
  private totalRequests = 0;

  constructor() {
    this.heap = new Heap<ApiRequest>((a, b) => a.retryCount! - b.retryCount!); // Use a dummy comparator for simplicity
    this.startProcessingInterval();
  }

  private startProcessingInterval() {
    // Process requests every minute
    setInterval(() => this.processRequests(), 60000); // 60000 ms = 1 minute
  }

  scheduleRequest(request: ApiRequest) {
    this.heap.push({
      ...request,
      retryCount: request.retryCount ?? 0,
      maxTries: request.maxTries ?? this.maxTries
    });
    this.totalRequests++;
  }

  private async processRequests() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    const now = Date.now();
    
    // Process the next request in the queue
    while (this.heap.size() > 0) {
      const request = this.heap.pop();
      if (request) {
        await this.executeRequest(request);
      }
    }
    
    this.isProcessing = false;
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
  
      this.totalRequests--;
      console.log(`Remaining requests: ${this.totalRequests}`);
  
      return response.data;
    } catch (error) {
      console.error(`Failed to execute request ${request.id}:`, error);
      this.retryRequest(request);
    }
  }

  private retryRequest(request: ApiRequest) {
    if ((request.retryCount ?? 0) >= (request.maxTries ?? this.maxTries)) {
      console.error(`Max retry attempts reached for request ${request.id}`);
      this.totalRequests--; // Decrement total requests when max retries are reached
      console.log(`Remaining requests: ${this.totalRequests}`);
      return;
    }

    const retryRequest = {
      ...request,
      retryCount: (request.retryCount ?? 0) + 1
    };

    this.heap.push(retryRequest);
    this.totalRequests++;
  }

  // Method to get the current number of scheduled requests
  getScheduledRequestsCount(): number {
    return this.totalRequests;
  }
}

export const scheduler = new ApiScheduler();
