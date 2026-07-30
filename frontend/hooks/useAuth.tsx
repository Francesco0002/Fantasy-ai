"use client";

/*
 * Funzioni che comunicano
 * con gli endpoint di autenticazione.
 */
import {
  ApiRequestError,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../lib/api";

/*
 * Tipi condivisi dell'autenticazione.
 */
import type {
  AuthUser,
  LoginUserInput,
  RegisterUserInput,
} from "../types/auth";

/*
 * Strumenti React utilizzati
 * per condividere l'utente nell'applicazione.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";


/*
 * Valori esposti dal contesto
 * di autenticazione.
 */
type AuthContextValue = {
  user: AuthUser | null;

  /*
   * Diventa true dopo aver controllato
   * l'eventuale cookie già presente.
   */
  isAuthReady: boolean;

  /*
   * Indica che è in corso
   * registrazione, login oppure logout.
   */
  isAuthActionLoading: boolean;

  authError: string | null;

  register: (
    input: RegisterUserInput,
  ) => Promise<boolean>;

  login: (
    input: LoginUserInput,
  ) => Promise<boolean>;

  logout: () => Promise<boolean>;

  clearAuthError: () => void;
};


/*
 * Il valore iniziale null permette
 * di rilevare l'uso dell'hook
 * fuori da AuthProvider.
 */
const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );


/*
 * Converte un errore sconosciuto
 * in un messaggio leggibile.
 */
function getAuthErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return (
    "Si è verificato un errore "
    + "durante l'autenticazione."
  );
}


/*
 * Provider globale che conserva
 * l'utente autenticato.
 */
export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    null,
  );

  const [
    isAuthReady,
    setIsAuthReady,
  ] = useState(false);

  const [
    isAuthActionLoading,
    setIsAuthActionLoading,
  ] = useState(false);

  const [
    authError,
    setAuthError,
  ] = useState<string | null>(
    null,
  );


  /*
   * All'avvio controlliamo se il browser
   * possiede già un cookie valido.
   */
  useEffect(() => {
    let isEffectActive = true;

    const controller =
      new AbortController();

    async function restoreAuthentication() {
      setAuthError(null);

      try {
        const currentUser =
          await fetchCurrentUser(
            controller.signal,
          );

        if (!isEffectActive) {
          return;
        }

        setUser(currentUser);
      } catch (error) {
        if (!isEffectActive) {
          return;
        }

        /*
         * 401 non è un errore applicativo:
         * significa semplicemente
         * che il visitatore non ha effettuato
         * l'accesso.
         */
        if (
          error instanceof ApiRequestError
          && error.status === 401
        ) {
          setUser(null);
          return;
        }

        /*
         * Ignoriamo l'interruzione causata
         * dallo smontaggio del componente.
         */
        if (
          error instanceof DOMException
          && error.name === "AbortError"
        ) {
          return;
        }

        setAuthError(
          getAuthErrorMessage(error),
        );
      } finally {
        if (isEffectActive) {
          setIsAuthReady(true);
        }
      }
    }

    void restoreAuthentication();

    return () => {
      isEffectActive = false;
      controller.abort();
    };
  }, []);


  /*
   * Registra un account e salva
   * immediatamente l'utente restituito.
   */
  const register = useCallback(
    async (
      input: RegisterUserInput,
    ): Promise<boolean> => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        const registeredUser =
          await registerUser(input);

        setUser(registeredUser);

        return true;
      } catch (error) {
        setAuthError(
          getAuthErrorMessage(error),
        );

        return false;
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [],
  );


  /*
   * Effettua il login e aggiorna
   * lo stato globale dell'utente.
   */
  const login = useCallback(
    async (
      input: LoginUserInput,
    ): Promise<boolean> => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        const authenticatedUser =
          await loginUser(input);

        setUser(authenticatedUser);

        return true;
      } catch (error) {
        setAuthError(
          getAuthErrorMessage(error),
        );

        return false;
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [],
  );


  /*
   * Elimina il cookie e rimuove
   * l'utente dallo stato globale.
   */
  const logout = useCallback(
    async (): Promise<boolean> => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        await logoutUser();

        setUser(null);

        return true;
      } catch (error) {
        setAuthError(
          getAuthErrorMessage(error),
        );

        return false;
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [],
  );


  const clearAuthError =
    useCallback(() => {
      setAuthError(null);
    }, []);


  /*
   * useMemo mantiene stabile il valore
   * condiviso finché i dati non cambiano.
   */
  const contextValue =
    useMemo<AuthContextValue>(
      () => ({
        user,
        isAuthReady,
        isAuthActionLoading,
        authError,
        register,
        login,
        logout,
        clearAuthError,
      }),
      [
        user,
        isAuthReady,
        isAuthActionLoading,
        authError,
        register,
        login,
        logout,
        clearAuthError,
      ],
    );


  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}


/*
 * Hook utilizzato dai componenti
 * per accedere all'utente corrente.
 */
export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth deve essere utilizzato "
      + "all'interno di AuthProvider.",
    );
  }

  return context;
}