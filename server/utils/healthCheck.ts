import { Request, Response } from 'express';

// Track application readiness state
let isApplicationReady = false;
let readinessChecks: { [key: string]: boolean } = {
  database: false,
  environment: false,
  services: false
};

export function setReadinessCheck(service: string, ready: boolean) {
  readinessChecks[service] = ready;
  
  // Update overall readiness - only critical services must be ready
  // Environment is critical, database and services can be degraded
  isApplicationReady = readinessChecks.environment && 
                      (readinessChecks.database || readinessChecks.services);
  
  console.log(`Readiness check ${service}: ${ready ? 'READY' : 'NOT READY'}`);
  console.log(`Overall application ready: ${isApplicationReady}`);
}

// Basic liveness check - always returns 200 if server is running
export function livenessCheck(req: Request, res: Response) {
  return res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '5000'
  });
}

// Full readiness check - checks if services are ready
export function healthCheck(req: Request, res: Response) {
  const uptime = process.uptime();
  
  // During startup phase (first 60 seconds), return detailed status
  const isStartupPhase = uptime < 60;
  
  const healthData = {
    status: isApplicationReady ? 'ready' : (isStartupPhase ? 'starting' : 'unhealthy'),
    timestamp: new Date().toISOString(),
    uptime: uptime,
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '5000',
    checks: readinessChecks,
    ready: isApplicationReady
  };

  // Log health check for debugging deployment issues
  if (process.env.NODE_ENV === 'production') {
    console.log('Health check accessed:', {
      url: req.url,
      method: req.method,
      status: healthData.status,
      ready: isApplicationReady,
      uptime: uptime,
      timestamp: new Date().toISOString()
    });
  }

  // Return appropriate HTTP status
  if (isApplicationReady) {
    return res.status(200).json(healthData);
  } else if (isStartupPhase) {
    // During startup, return 503 Service Unavailable but with retry info
    return res.status(503).json({
      ...healthData,
      message: 'Application is starting up, please retry in a few moments'
    });
  } else {
    // After startup window, something is wrong
    return res.status(503).json({
      ...healthData,
      message: 'Application failed to initialize properly'
    });
  }
}