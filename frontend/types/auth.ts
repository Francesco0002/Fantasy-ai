/*
 * Dati pubblici dell'utente
 * restituiti dal backend.
 *
 * Password e relativo hash
 * non vengono mai ricevuti dal frontend.
 */
export type AuthUser = {
  id: string;

  email: string;

  displayName: string;

  isActive: boolean;

  createdAt: string;
};


/*
 * Dati inviati durante
 * la registrazione.
 */
export type RegisterUserInput = {
  email: string;

  displayName: string;

  password: string;
};


/*
 * Credenziali inviate
 * durante il login.
 */
export type LoginUserInput = {
  email: string;

  password: string;
};