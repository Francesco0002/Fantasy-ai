"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    usePathname,
    useRouter,
} from "next/navigation";


/*
 * Nome dell'evento utilizzato dalla Home
 * per avviare la transizione.
 */
const AUCTION_TRANSITION_EVENT =
    "fantasy-ai:open-auction";


/*
 * Coordinate del punto da cui
 * deve partire la Mask Reveal.
 */
type AuctionTransitionDetail = {
    originX: number;
    originY: number;
};


/*
 * Fasi della transizione.
 */
type TransitionPhase =
    | "IDLE"
    | "COVERING"
    | "WAITING_ROUTE"
    | "UNCOVERING";


/*
 * Overlay globale persistente.
 *
 * Essendo montato nel layout principale,
 * non viene eliminato durante il passaggio
 * dalla Home alla pagina dell'asta.
 */
export default function AuctionPageTransition() {
    const router = useRouter();
    const pathname = usePathname();


    /*
     * Elemento verde che copre
     * progressivamente lo schermo.
     */
    const overlayRef =
        useRef<HTMLDivElement | null>(
            null,
        );


    /*
     * Contenuto centrale mostrato
     * durante il caricamento.
     */
    const contentRef =
        useRef<HTMLDivElement | null>(
            null,
        );


    /*
     * Fase attualmente in esecuzione.
     */
    const phaseRef =
        useRef<TransitionPhase>("IDLE");


    /*
     * Coordinate e raggio conservati
     * anche durante il cambio pagina.
     */
    const revealGeometryRef =
        useRef({
            originX: 0,
            originY: 0,
            radius: 0,
        });


    /*
     * Animazione principale attiva.
     */
    const activeAnimationRef =
        useRef<Animation | null>(null);


    /*
     * Animazione del testo centrale.
     */
    const contentAnimationRef =
        useRef<Animation | null>(null);


    /*
     * Quando true, l'overlay blocca
     * i clic sulla pagina sottostante.
     */
    const [
        isBlockingPage,
        setIsBlockingPage,
    ] = useState(false);


    /*
     * Ascolta l'evento inviato dalla Home
     * e avvia la copertura dello schermo.
     */
    useEffect(() => {
        /*
         * Prepariamo anticipatamente
         * la pagina dell'asta.
         */
        router.prefetch("/auction");


        function handleAuctionTransition(
            event: Event,
        ) {
            /*
             * Evitiamo più transizioni
             * contemporaneamente.
             */
            if (
                phaseRef.current !== "IDLE"
            ) {
                return;
            }


            const customEvent =
                event as CustomEvent<
                    AuctionTransitionDetail
                >;


            const {
                originX,
                originY,
            } = customEvent.detail;


            const overlayElement =
                overlayRef.current;

            const contentElement =
                contentRef.current;


            if (
                !overlayElement ||
                !contentElement
            ) {
                router.push("/auction");
                return;
            }


            /*
             * Calcoliamo la distanza
             * dall'angolo più lontano.
             */
            const horizontalDistance =
                Math.max(
                    originX,
                    window.innerWidth - originX,
                );

            const verticalDistance =
                Math.max(
                    originY,
                    window.innerHeight - originY,
                );


            const radius =
                Math.hypot(
                    horizontalDistance,
                    verticalDistance,
                ) + 40;


            revealGeometryRef.current = {
                originX,
                originY,
                radius,
            };


            const initialClipPath =
                `circle(0px at ${originX}px ${originY}px)`;

            const coveredClipPath =
                `circle(${radius}px at ${originX}px ${originY}px)`;


            /*
             * Prepariamo l'overlay.
             */
            overlayElement.style.visibility =
                "visible";

            overlayElement.style.clipPath =
                initialClipPath;

            contentElement.style.opacity =
                "0";


            setIsBlockingPage(true);

            phaseRef.current =
                "COVERING";


            activeAnimationRef.current
                ?.cancel();

            contentAnimationRef.current
                ?.cancel();


            /*
             * Espansione della maschera.
             */
            const coveringAnimation =
                overlayElement.animate(
                    [
                        {
                            clipPath:
                                initialClipPath,
                        },
                        {
                            clipPath:
                                coveredClipPath,
                        },
                    ],
                    {
                        duration: 850,

                        easing:
                            "cubic-bezier(0.65, 0, 0.35, 1)",

                        fill: "forwards",
                    },
                );


            /*
             * Comparsa graduale del testo.
             */
            const textAnimation =
                contentElement.animate(
                    [
                        {
                            opacity: 0,
                            transform:
                                "translateY(10px)",
                        },
                        {
                            opacity: 1,
                            transform:
                                "translateY(0px)",
                        },
                    ],
                    {
                        duration: 300,
                        delay: 300,
                        easing: "ease-out",
                        fill: "forwards",
                    },
                );


            activeAnimationRef.current =
                coveringAnimation;

            contentAnimationRef.current =
                textAnimation;


            coveringAnimation.finished
                .then(() => {
                    if (
                        phaseRef.current !==
                        "COVERING"
                    ) {
                        return;
                    }


                    /*
                     * Trasferiamo il risultato
                     * dell'animazione nello stile inline,
                     * quindi eliminiamo l'animazione.
                     */
                    overlayElement.style.clipPath =
                        coveredClipPath;

                    contentElement.style.opacity =
                        "1";

                    coveringAnimation.cancel();
                    textAnimation.cancel();


                    activeAnimationRef.current =
                        null;

                    contentAnimationRef.current =
                        null;


                    /*
                     * Manteniamo lo schermo coperto
                     * mentre Next.js cambia pagina.
                     */
                    phaseRef.current =
                        "WAITING_ROUTE";

                    router.push("/auction");
                })
                .catch(() => {
                    /*
                     * La Promise viene rifiutata
                     * quando l'animazione è annullata.
                     */
                });
        }


        window.addEventListener(
            AUCTION_TRANSITION_EVENT,
            handleAuctionTransition,
        );


        return () => {
            window.removeEventListener(
                AUCTION_TRANSITION_EVENT,
                handleAuctionTransition,
            );

            activeAnimationRef.current
                ?.cancel();

            contentAnimationRef.current
                ?.cancel();
        };
    }, [router]);


    /*
    * Quando la pagina dell'asta è pronta,
    * rimuoviamo gradualmente la copertura.
    *
    * Non richiudiamo più il cerchio
    * verso il vecchio pulsante.
    *
    * La superficie verde continua invece
    * il proprio movimento verso l'esterno
    * e scompare con una dissolvenza morbida.
    */
    useEffect(() => {
        if (
            pathname !== "/auction" ||
            phaseRef.current !==
            "WAITING_ROUTE"
        ) {
            return;
        }


        const overlayElement =
            overlayRef.current;

        const contentElement =
            contentRef.current;


        if (
            !overlayElement ||
            !contentElement
        ) {
            phaseRef.current = "IDLE";
            setIsBlockingPage(false);
            return;
        }


        phaseRef.current =
            "UNCOVERING";


        /*
         * Prepariamo l'overlay nello stato
         * completamente visibile.
         */
        overlayElement.style.visibility =
            "visible";

        overlayElement.style.opacity =
            "1";

        overlayElement.style.transform =
            "scale(1)";


        /*
         * Aspettiamo due frame per consentire
         * alla nuova pagina di essere disegnata
         * sotto la copertura verde.
         */
        let secondFrameId:
            number | null = null;


        const firstFrameId =
            window.requestAnimationFrame(
                () => {
                    secondFrameId =
                        window.requestAnimationFrame(
                            () => {
                                /*
                                 * Il testo centrale scompare
                                 * prima della copertura.
                                 */
                                const textAnimation =
                                    contentElement.animate(
                                        [
                                            {
                                                opacity: 1,
                                                transform:
                                                    "translateY(0px)",
                                            },
                                            {
                                                opacity: 0,
                                                transform:
                                                    "translateY(-8px)",
                                            },
                                        ],
                                        {
                                            duration: 180,

                                            easing:
                                                "cubic-bezier(0.4, 0, 1, 1)",

                                            fill: "forwards",
                                        },
                                    );


                                /*
                                 * La superficie verde:
                                 *
                                 * - aumenta leggermente di scala;
                                 * - diventa trasparente;
                                 * - lascia apparire la nuova pagina.
                                 *
                                 * Non modifica più il clip-path
                                 * e quindi non torna verso
                                 * il vecchio pulsante.
                                 */
                                const exitAnimation =
                                    overlayElement.animate(
                                        [
                                            {
                                                opacity: 1,
                                                transform:
                                                    "scale(1)",
                                            },
                                            {
                                                opacity: 0,
                                                transform:
                                                    "scale(1.025)",
                                            },
                                        ],
                                        {
                                            duration: 560,
                                            delay: 60,

                                            easing:
                                                "cubic-bezier(0.22, 1, 0.36, 1)",

                                            fill: "forwards",
                                        },
                                    );


                                activeAnimationRef.current =
                                    exitAnimation;

                                contentAnimationRef.current =
                                    textAnimation;


                                exitAnimation.finished
                                    .then(() => {
                                        /*
                                         * Nascondiamo l'overlay
                                         * dopo la dissolvenza.
                                         */
                                        overlayElement.style
                                            .visibility =
                                            "hidden";


                                        /*
                                         * Ripristiniamo tutti gli stili
                                         * per la transizione successiva.
                                         */
                                        overlayElement.style.opacity =
                                            "1";

                                        overlayElement.style.transform =
                                            "scale(1)";

                                        overlayElement.style.clipPath =
                                            "circle(0px at 50% 50%)";

                                        contentElement.style.opacity =
                                            "0";

                                        contentElement.style.transform =
                                            "translateY(0px)";


                                        /*
                                         * Rimuoviamo gli effetti
                                         * mantenuti da fill: forwards.
                                         */
                                        exitAnimation.cancel();
                                        textAnimation.cancel();


                                        activeAnimationRef.current =
                                            null;

                                        contentAnimationRef.current =
                                            null;

                                        phaseRef.current =
                                            "IDLE";

                                        setIsBlockingPage(false);
                                    })
                                    .catch(() => {
                                        /*
                                         * La Promise viene rifiutata
                                         * solamente se l'animazione
                                         * viene annullata.
                                         */
                                    });
                            },
                        );
                },
            );


        return () => {
            window.cancelAnimationFrame(
                firstFrameId,
            );

            if (secondFrameId !== null) {
                window.cancelAnimationFrame(
                    secondFrameId,
                );
            }
        };
    }, [pathname]);


    return (
        <div
            ref={overlayRef}
            aria-hidden="true"
            className={`
        fixed inset-0 z-[5000]
        bg-emerald-700

        ${isBlockingPage
                    ? "pointer-events-auto"
                    : "pointer-events-none"
                }
      `}
            style={{
                clipPath:
                    "circle(0px at 50% 50%)",

                visibility: "hidden",
            }}
        >
            <div
                ref={contentRef}
                className="
          flex h-full items-center
          justify-center
          opacity-0
        "
            >
                <div className="text-center text-white">
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-100">
                        Fantasy AI
                    </p>

                    <p className="mt-2 text-2xl font-bold">
                        Preparazione modalità asta
                    </p>

                    <div className="mx-auto mt-5 h-1 w-24 overflow-hidden rounded-full bg-emerald-800">
                        <div className="h-full w-full bg-white" />
                    </div>
                </div>
            </div>
        </div>
    );
}