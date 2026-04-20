declare global {
  interface Window {
    grecaptcha: {
      reset: () => void;
      getResponse: () => string;
    };
  }
}

export {};
