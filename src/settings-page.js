// Some desktop renderers expose the navigation rail before the native settings
// adapter is available. In that shell the page shares the main content area.
export function localSettingsPage(mount) {
  const selected = () => history.state?.ihatejargonsPage === location.href;
  let page, unmount;
  function contentArea() {
    return [...document.querySelectorAll("main[data-app-shell-main-surface],main")].find(
      main => !main.closest("[hidden],[inert]") && main.getClientRects().length && !main.querySelector("nav[data-app-navigation-rail]")
    );
  }
  function detach() {
    if (!page) return;
    unmount();
    page.remove();
    page = null;
  }
  function sync() {
    if (!selected()) return detach();
    if (page?.isConnected) return;
    detach();
    const main = contentArea();
    if (!main) return;
    page = document.createElement("section");
    page.className = "ihj-settings-page";
    page.setAttribute("aria-label","ihatejargons 设置");
    page.tabIndex = -1;
    main.append(page);
    unmount = mount(page);
    page.focus({preventScroll:true});
  }
  function open() {
    if (!selected()) {
      history.pushState({...history.state,ihatejargonsPage:location.href},"");
    }
    sync();
  }
  function leaveViaSidebar(event) {
    if (!selected() || !(event.target instanceof Element) || event.target.closest(".ihj-rail-settings,[data-ihj-sidebar]")) return;
    if (!event.target.closest("nav[data-app-navigation-rail] :is(button,a),[data-app-action-sidebar-thread-row],[data-sidebar-navigation-root] :is(a,button,[role=button])")) return;
    const state={...history.state};
    delete state.ihatejargonsPage;
    history.replaceState(state,"");
    detach();
  }
  addEventListener("popstate",sync);
  document.addEventListener("click",leaveViaSidebar,true);
  return {open,sync,selected,dispose(){
    removeEventListener("popstate",sync);
    document.removeEventListener("click",leaveViaSidebar,true);
    detach();
  }};
}
