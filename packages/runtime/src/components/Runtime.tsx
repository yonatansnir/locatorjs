import { detectSvelte, Fiber, Targets } from "@locator/shared";
import { batch, createEffect, createSignal, For, onCleanup } from "solid-js";
import { render } from "solid-js/web";
import { AdapterId } from "../consts";
import { fiberToSimple } from "../adapters/react/fiberToSimple";
import { gatherFiberRoots } from "../adapters/react/gatherFiberRoots";
import { isCombinationModifiersPressed } from "../functions/isCombinationModifiersPressed";
import { trackClickStats } from "../functions/trackClickStats";
import { LinkProps, SimpleNode, Targets as SetupTargets } from "../types/types";
import { getIdsOnPathToRoot } from "../functions/getIdsOnPathToRoot";
import { RootTreeNode } from "./RootTreeNode";
import { MaybeOutline } from "./MaybeOutline";
import { SimpleNodeOutline } from "./SimpleNodeOutline";
import { hasExperimentalFeatures } from "../functions/hasExperimentalFeatures";
import { IntroInfo } from "./IntroInfo";
import { Options } from "./Options";
import { bannerClasses } from "../functions/bannerClasses";
import BannerHeader from "./BannerHeader";
import { isExtension } from "../functions/isExtension";
import { getLocalStorageLinkTemplate } from "../functions/linkTemplateUrl";
import { NoLinkDialog } from "./NoLinkDialog";
import { ChooseEditorDialog } from "./ChooseEditorDialog";
import { isLocatorsOwnElement } from "../functions/isLocatorsOwnElement";
import { goToLinkProps } from "../functions/goTo";
import { getSavedProjectPath } from "../functions/buildLink";
import { getElementInfo } from "../functions/getElementInfo";

function Runtime(props: { adapterId?: AdapterId; targets: Targets }) {
  const [uiMode, setUiMode] = createSignal<
    ["off"] | ["options"] | ["tree"] | ["treeFromElement", HTMLElement]
  >(["off"]);
  const [holdingModKey, setHoldingModKey] = createSignal<boolean>(false);
  const [currentElement, setCurrentElement] = createSignal<HTMLElement | null>(
    null
  );

  const [dialog, setDialog] = createSignal<
    ["no-link"] | ["choose-editor", LinkProps] | null
  >(null);

  const [highlightedNode, setHighlightedNode] = createSignal<null | SimpleNode>(
    null
  );

  createEffect(() => {
    if (holdingModKey() && currentElement()) {
      document.body.classList.add("locatorjs-active-pointer");
    } else {
      document.body.classList.remove("locatorjs-active-pointer");
    }
  });

  createEffect(() => {
    if (uiMode()[0] === "tree" || uiMode()[0] === "treeFromElement") {
      document.body.classList.add("locatorjs-move-body");
    } else {
      document.body.classList.remove("locatorjs-move-body");
    }
  });

  function keyUpListener(e: KeyboardEvent) {
    if (hasExperimentalFeatures()) {
      if (e.code === "KeyO" && isCombinationModifiersPressed(e)) {
        if (uiMode()[0] === "tree") {
          setUiMode(["off"]);
        } else {
          setUiMode(["tree"]);
        }
      }
    }

    setHoldingModKey(isCombinationModifiersPressed(e));
  }

  function keyDownListener(e: KeyboardEvent) {
    setHoldingModKey(isCombinationModifiersPressed(e));
  }

  function mouseOverListener(e: MouseEvent) {
    setHoldingModKey(isCombinationModifiersPressed(e));

    const target = e.target;
    if (target && target instanceof HTMLElement) {
      // Ignore LocatorJS elements
      if (isLocatorsOwnElement(target)) {
        return;
      }

      batch(() => {
        setCurrentElement(target);
        // TODO: this is for highlighting elements in the tree, but need to move it to the adapter
        // if (solidMode()[0] === "tree" || solidMode()[0] === "treeFromElement") {
        //   const fiber = findFiberByHtmlElement(target, false);
        //   if (fiber) {
        //     const id = fiberToSimple(fiber, []);
        //     setHighlightedNode(id);
        //   }
        // }
      });

      // const found =
      //   target.closest("[data-locatorjs-id]") ||
      //   searchDevtoolsRenderersForClosestTarget(target);
      // if (found && found instanceof HTMLElement) {
      //   setCurrentElement(found);
      // }
    }
  }

  function clickListener(e: MouseEvent) {
    if (!isCombinationModifiersPressed(e)) {
      return;
    }

    const target = e.target;
    if (target && target instanceof HTMLElement) {
      if (isLocatorsOwnElement(target)) {
        return;
      }

      const elInfo = getElementInfo(target, props.adapterId);

      if (elInfo) {
        const linkProps = elInfo.thisElement.link;
        if (linkProps) {
          e.preventDefault();
          e.stopPropagation();
          trackClickStats();
          if (
            (!isExtension() && !getLocalStorageLinkTemplate()) ||
            (detectSvelte() && !linkProps.projectPath && !getSavedProjectPath())
          ) {
            setDialog(["choose-editor", linkProps]);
          } else {
            // const link = buidLink(linkProps, props.targets);
            goToLinkProps(linkProps, props.targets);
          }
        } else {
          console.error(
            "[LocatorJS]: Could not find link: Element info: ",
            elInfo
          );
          setDialog(["no-link"]);
        }
      } else {
        console.error(
          "[LocatorJS]: Could not find element info. Element: ",
          target
        );
        setDialog(["no-link"]);
      }
    }
  }

  function scrollListener() {
    setCurrentElement(null);
  }

  document.addEventListener("mouseover", mouseOverListener, {
    capture: true,
  });
  document.addEventListener("keydown", keyDownListener);
  document.addEventListener("keyup", keyUpListener);
  document.addEventListener("click", clickListener, { capture: true });
  document.addEventListener("scroll", scrollListener);

  onCleanup(() => {
    document.removeEventListener("keyup", keyUpListener);
    document.removeEventListener("keydown", keyDownListener);
    document.removeEventListener("mouseover", mouseOverListener, {
      capture: true,
    });
    document.removeEventListener("click", clickListener, { capture: true });
    document.removeEventListener("scroll", scrollListener);
  });

  const getAllNodes = (): SimpleNode[] => {
    if (uiMode()[0] === "tree" || uiMode()[0] === "treeFromElement") {
      const foundFiberRoots: Fiber[] = [];

      gatherFiberRoots(document.body, foundFiberRoots);

      const simpleRoots = foundFiberRoots.map((fiber) => {
        return fiberToSimple(fiber);
      });

      return simpleRoots;
    }
    //  else if () {
    //   const pathToParentTree = getIdsOnPathToRoot(solidMode()[1]!);
    //   if (pathToParentTree) {
    //     return [pathToParentTree];
    //   }
    // }
    return [];
  };

  function showTreeFromElement(element: HTMLElement) {
    setUiMode(["treeFromElement", element]);
  }

  function openOptions() {
    setUiMode(["options"]);
  }
  return (
    <>
      {uiMode()[0] === "tree" || uiMode()[0] === "treeFromElement" ? (
        <div
          // id="locator-solid-overlay"
          // onClick={(e) => {
          //   setSolidMode(["off"]);
          // }}
          style={{
            position: "fixed",
            top: "0",
            left: "0",
            width: "50vw",
            height: "100vh",
            overflow: "auto",
            "pointer-events": "auto",
          }}
        >
          <For each={getAllNodes()}>
            {(node) => (
              <RootTreeNode
                node={node}
                idsToShow={
                  uiMode()[0] === "treeFromElement"
                    ? getIdsOnPathToRoot(uiMode()[1]!)
                    : {}
                }
                highlightedNode={{
                  getNode: highlightedNode,
                  setNode: (newId) => {
                    setHighlightedNode(newId);
                  },
                }}
                targets={props.targets}
              />
            )}
          </For>
          {/* <For each={getAllNodes()}>
            {(node, i) => (
              <RenderXrayNode node={node} parentIsHovered={false} />
            )}
          </For> */}
        </div>
      ) : null}
      {holdingModKey() && currentElement() ? (
        <MaybeOutline
          currentElement={currentElement()!}
          showTreeFromElement={showTreeFromElement}
          adapterId={props.adapterId}
          targets={props.targets}
        />
      ) : null}
      {holdingModKey() ? (
        <div class={bannerClasses()}>
          <BannerHeader openOptions={openOptions} adapter={props.adapterId} />
        </div>
      ) : null}
      {highlightedNode() ? (
        <SimpleNodeOutline node={highlightedNode()!} />
      ) : null}
      {!isExtension() ? (
        <IntroInfo
          openOptions={openOptions}
          hide={!!holdingModKey() || uiMode()[0] !== "off"}
          adapter={props.adapterId}
        />
      ) : null}
      {uiMode()[0] === "options" ? (
        <Options
          adapterId={props.adapterId}
          targets={props.targets}
          onClose={() => {
            setUiMode(["off"]);
          }}
        />
      ) : null}
      {/* {holdingModKey() &&
      currentElement() &&
      getElementInfo(currentElement()!) ? (
        <Outline element={getElementInfo(currentElement()!)!} />
      ) : null} */}
      {dialog() && (
        <div
          class="fixed top-0 left-0 w-screen h-screen flex items-center justify-center bg-black/70 pointer-events-auto"
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              setDialog(null);
            }
          }}
        >
          {dialog()![0] === "no-link" && <NoLinkDialog />}
          {dialog()![0] === "choose-editor" && (
            <ChooseEditorDialog
              targets={props.targets}
              originalLinkProps={dialog()![1]!}
              onClose={() => {
                setDialog(null);
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

export function initRender(
  solidLayer: HTMLDivElement,
  adapter: AdapterId | undefined,
  targets: SetupTargets
) {
  render(
    () => (
      <Runtime
        targets={Object.fromEntries(
          Object.entries(targets).map(([key, t]) => {
            return [key, typeof t == "string" ? { url: t, label: key } : t];
          })
        )}
        adapterId={adapter}
      />
    ),
    solidLayer
  );
}
