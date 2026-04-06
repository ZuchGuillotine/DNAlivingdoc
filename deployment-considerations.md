# Deployment Considerations for Google OAuth

This document outlines the necessary steps to ensure Google OAuth works correctly in a deployed environment.

## 1. Google Cloud Console Configuration

Before deploying, you must configure your Google Cloud Console project with the correct **Authorized redirect URIs**. These URIs are where Google will send the user back to after they have authenticated.

The callback URL is determined by the environment your application is running in. You need to add the correct redirect URI for each environment.

### Production Environment

-   **URL:** `https://<your-custom-domain>/auth/google/callback`
-   Replace `<your-custom-domain>` with your actual domain name.

### Development Environment (Replit)

-   **URL:** `https://<repl-slug>.<repl-owner>.repl.co/auth/google/callback`
-   Replace `<repl-slug>` and `<repl-owner>` with your Replit slug and owner name. The slug should be all lowercase.

### Local Development

-   **URL:** `http://0.0.0.0:5000/auth/google/callback`

**To add these URIs:**

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2.  Select your project.
3.  Go to the **Credentials** page.
4.  Click on your OAuth 2.0 Client ID.
5.  Under **Authorized redirect URIs**, click **ADD URI** and add the URIs for your environments.

## 2. Environment Variables

Your application uses environment variables to configure Google OAuth. These variables must be set in your deployment environment.

-   `GOOGLE_CLIENT_ID_PROD`: Your Google OAuth client ID for production.
-   `GOOGLE_CLIENT_SECRET_PROD`: Your Google OAuth client secret for production.
-   `CUSTOM_DOMAIN`: Your application's custom domain name (e.g., `stacktracker.io`). This is used to construct the production callback URL.
-   `NODE_ENV`: Set to `production` in your production environment.

## 3. Deployment

When you deploy the application, ensure that the environment variables listed above are set correctly. If you are using a platform like Heroku, Vercel, or AWS, they will have a section for setting environment variables.

**It is not necessary to deploy the application concurrently with making changes in the Google Cloud Console.** You can configure the redirect URIs in the Google Cloud Console at any time. However, Google OAuth will not work until the redirect URIs are correctly configured and the application is deployed with the correct environment variables. 