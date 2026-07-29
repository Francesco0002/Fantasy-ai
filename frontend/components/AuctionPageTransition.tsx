"use client";

import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    createPortal,
} from "react-dom";

import {
    usePathname,
    useRouter,
} from "next/navigation";


const AUCTION_TRANSITION_EVENT =
    "fantasy-ai:open-auction";


type AuctionTransitionDetail = {
    originX: number;
    originY: number;
};


type TransitionPhase =
    | "IDLE"
    | "COVERING"
    | "WAITING_ROUTE"
    | "UNCOVERING";


export default function AuctionPageTransition() {
    const router = useRouter();
    const pathname = usePathname();

    const [
        isMounted,
        setIsMounted,
    ] = useState(false);

    const [
        isBlockingPage,
        setIsBlockingPage,
    ] = useState(false);


    const overlayRef =
        useRef<HTMLDivElement | null>(
            null,
        );

    const circleRef =
        useRef<HTMLDivElement | null>(
            null,
        );

    const contentRef =
        useRef<HTMLDivElement | null>(
            null,
        );

    const phaseRef =
        useRef<TransitionPhase>(
            "IDLE",
        );

    const activeAnimationRef =
        useRef<Animation | null>(
            null,
        );

    const contentAnimationRef =
        useRef<Animation | null>(
            null,
        );


    useEffect(() => {
        setIsMounted(true);
    }, []);


    /*
     * Copertura della Home.
     */
    useEffect(() => {
        router.prefetch("/auction");


        function handleAuctionTransition(
            event: Event,
        ) {
            if (
                phaseRef.current !==
                "IDLE"
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

            const circleElement =
                circleRef.current;

            const contentElement =
                contentRef.current;


            if (
                !overlayElement ||
                !circleElement ||
                !contentElement
            ) {
                router.push("/auction");

                return;
            }


            /*
             * Il pulsante fornisce coordinate
             * relative alla viewport.
             *
             * Il cerchio è posizionato dentro
             * l'overlay, quindi convertiamo il
             * centro nelle coordinate locali
             * dell'overlay.
             */
            const overlayRectangle =
                overlayElement
                    .getBoundingClientRect();

            const localOriginX =
                originX -
                overlayRectangle.left;

            const localOriginY =
                originY -
                overlayRectangle.top;


            /*
             * Raggio necessario per raggiungere
             * l'angolo più lontano.
             */
            const horizontalDistance =
                Math.max(
                    localOriginX,
                    overlayRectangle.width -
                    localOriginX,
                );

            const verticalDistance =
                Math.max(
                    localOriginY,
                    overlayRectangle.height -
                    localOriginY,
                );

            const radius =
                Math.hypot(
                    horizontalDistance,
                    verticalDistance,
                ) + 40;

            const diameter =
                radius * 2;


            /*
             * Il centro geometrico del cerchio
             * coincide con il centro del pulsante.
             */
            circleElement.style.left =
                `${localOriginX}px`;

            circleElement.style.top =
                `${localOriginY}px`;

            circleElement.style.width =
                `${diameter}px`;

            circleElement.style.height =
                `${diameter}px`;

            circleElement.style.transform =
                "translate(-50%, -50%) scale(0)";


            overlayElement.style.visibility =
                "visible";

            overlayElement.style.opacity =
                "1";

            contentElement.style.opacity =
                "0";

            contentElement.style.transform =
                "translateY(10px)";


            setIsBlockingPage(true);

            phaseRef.current =
                "COVERING";


            activeAnimationRef.current
                ?.cancel();

            contentAnimationRef.current
                ?.cancel();


            /*
             * Espansione del cerchio.
             */
            const coveringAnimation =
                circleElement.animate(
                    [
                        {
                            transform:
                                "translate(-50%, -50%) scale(0)",
                        },
                        {
                            transform:
                                "translate(-50%, -50%) scale(1)",
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
             * Comparsa del contenuto centrale.
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
                     * Conserviamo lo stato finale
                     * prima di annullare le animazioni.
                     */
                    circleElement.style.transform =
                        "translate(-50%, -50%) scale(1)";

                    contentElement.style.opacity =
                        "1";

                    contentElement.style.transform =
                        "translateY(0px)";


                    coveringAnimation.cancel();
                    textAnimation.cancel();

                    activeAnimationRef.current =
                        null;

                    contentAnimationRef.current =
                        null;


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
     * Dissolvenza dopo il caricamento
     * della pagina dell'asta.
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

        const circleElement =
            circleRef.current;

        const contentElement =
            contentRef.current;


        if (
            !overlayElement ||
            !circleElement ||
            !contentElement
        ) {
            phaseRef.current =
                "IDLE";

            setIsBlockingPage(false);

            return;
        }


        phaseRef.current =
            "UNCOVERING";

        overlayElement.style.visibility =
            "visible";

        overlayElement.style.opacity =
            "1";


        let secondFrameId:
            number | null = null;


        const firstFrameId =
            window.requestAnimationFrame(
                () => {
                    secondFrameId =
                        window.requestAnimationFrame(
                            () => {
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


                                const exitAnimation =
                                    overlayElement.animate(
                                        [
                                            {
                                                opacity: 1,
                                            },
                                            {
                                                opacity: 0,
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
                                        overlayElement.style
                                            .visibility =
                                            "hidden";

                                        overlayElement.style.opacity =
                                            "1";


                                        circleElement.style.transform =
                                            "translate(-50%, -50%) scale(0)";

                                        circleElement.style.width =
                                            "0px";

                                        circleElement.style.height =
                                            "0px";

                                        circleElement.style.left =
                                            "0px";

                                        circleElement.style.top =
                                            "0px";


                                        contentElement.style.opacity =
                                            "0";

                                        contentElement.style.transform =
                                            "translateY(0px)";


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
                                         * Animazione annullata.
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

            if (
                secondFrameId !== null
            ) {
                window.cancelAnimationFrame(
                    secondFrameId,
                );
            }
        };
    }, [pathname]);


    if (!isMounted) {
        return null;
    }


    return createPortal(
        <div
            ref={overlayRef}
            aria-hidden="true"
            className={`
        fixed inset-0 z-[5000]
        overflow-hidden

        ${isBlockingPage
                    ? "pointer-events-auto"
                    : "pointer-events-none"
                }
      `}
            style={{
                visibility: "hidden",
                opacity: 1,
            }}
        >
            {/* Cerchio verde */}
            <div
                ref={circleRef}
                className="
          absolute rounded-full
          bg-emerald-700
          will-change-transform
        "
                style={{
                    width: 0,
                    height: 0,
                    left: 0,
                    top: 0,

                    transform:
                        "translate(-50%, -50%) scale(0)",

                    transformOrigin:
                        "center",
                }}
            />


            {/* Contenuto centrale */}
            <div
                ref={contentRef}
                className="
          absolute inset-0 z-10
          flex items-center
          justify-center opacity-0
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
        </div>,
        document.body,
    );
}