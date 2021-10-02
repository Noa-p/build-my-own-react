function createElement(type, props, ...children) {
    return {
        type,
        props: {
            ...props,
            children: children.map(child => 
                typeof child == "object"
                    ? child
                    : createTextElement(child)
            )
        },
    }
}
  
function createTextElement(text) {
    return {
        type: "TEXT_ELEMENT",
        props: {
            nodeValue: text,
            children: [],
        },
    }
}
  
function createDom(fiber) {
    //create dom node
    const dom = 
        fiber.type == "TEXT_ELEMENT"
        ? document.createTextNode("")
        : document.createElement(fiber.type)

    const isProperty = key => key !== "children"
    Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(name => {
            dom[name] = fiber.props[name]
        })

    return dom
}

const isEvent = key => key.startsWith("on")
const isProperty = key => key !== "children" && !isEvent(key)
const isNew = (prev, next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)
function updateDom(dom, prevProps, nextProps) {
    //Remove old or changed event listeners
    Object.keys(prevProps)
        .forEach(name => {
            console.log("name:", name)
        })
    Object.keys(prevProps)
        .filter(isEvent)        
        .filter(
            key => 
                !(key in nextProps) ||
                isNew(prevProps, nextProps)(key)
        )
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.removeEventListener(
                eventType,
                prevProps[name]
            )
        })
    //Remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = ""
        })
    //Set new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name]
        })
    //Add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name
                .toLowerCase()
                .substring(2)
            dom.addEventListener(
                eventType, 
                nextProps[name]
            )
        })
}

function commitRoot() {
    deletions.forEach(commitWork)
    commitWork(wipRoot.child)
    console.log(wipRoot)
    currentRoot = wipRoot
    wipRoot = null
}

function commitWork(fiber) {
    if (!fiber) {
        return
    }

    let domParentFiber = fiber.parent
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent
    }
    const domParent = domParentFiber.dom

    if (
        fiber.effectTag === "PLACEMENT" &&
        fiber.dom != null
    ) {
        domParent.appendChild(fiber.dom)
    } else if (fiber.effectTag === "DELETION") {
        commitDeletion(fiber, domParent)
    } else if (
        fiber.effectTag === "UPDATE" &&
        fiber.dom != null
    ) {
        updateDom(
            fiber.dom,
            fiber.alternate.props,
            fiber.props
        )
    }
    commitWork(fiber.child)
    commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom)
    } else {
        commitDeletion(fiber.child, domParent)
    }
}

function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot
    }
    deletions = []
    nextUnitOfWork = wipRoot
}

let nextUnitOfWork = null
let currentRoot = null
let wipRoot = null
let deletions = null
function workLoop(deadline) {
    let shouldYield = false
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(
            nextUnitOfWork
        )
        shouldYield = deadline.timeRemaining() < 1
    }

    if (!nextUnitOfWork && wipRoot) {
        commitRoot()
    }

    requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

function performUnitOfWork(fiber) {

    const isFunctionComponent = 
        fiber.type instanceof Function
    if (isFunctionComponent) {
        updateFunctionComponent(fiber)
    } else {
        updateHostComponent(fiber)
    }

    //TODO return next unit of work
    if (fiber.child) {
        return fiber.child
    }
    let nextFiber = fiber
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling
        }
        nextFiber = nextFiber.parent
    }
}

let wipFiber = null
let hookIndex = null

function updateFunctionComponent(fiber) {
    //TODO
    wipFiber = fiber
    hookIndex = 0
    wipFiber.hooks = []
    const children = [fiber.type(fiber.props)]
    reconcileChildren(fiber, children)
}

function useState(initail) {
    
    const oldHook = 
        wipFiber.alternate && 
        wipFiber.alternate.hooks && 
        wipFiber.alternate.hooks[hookIndex]
    const hook = {
        state: oldHook ? oldHook.state : initail,
        queue: [],
    }

    const actions = oldHook ? oldHook.queue : []
    actions.forEach(action => {
        hook.state = action(hook.state)
    })

    const setState = action => {
        console.log("action:", typeof action, JSON.stringify(action))
        hook.queue.push(action)
        wipRoot = {
            dom: currentRoot.dom,
            props: currentRoot.props,
            alternate: currentRoot
        }
        nextUnitOfWork = wipRoot
        deletions = []
    }

    wipFiber.hooks.push(hook)
    hookIndex++
    return [hook.state, setState]
}

function updateHostComponent(fiber) {
    //TODO add a dom node
    if (!fiber.dom) {
        fiber.dom = createDom(fiber)
    }
    //TODO create new fibers
    reconcileChildren(fiber, fiber.props.children)
}

function reconcileChildren(wipFiber, elements) {
    let index = 0
    let oldFiber = 
        wipFiber.alternate && wipFiber.alternate.child
    let prevSibling = null

    while (
        index < elements.length ||
        oldFiber != null
    ) {
        const element = elements[index]
        const newFiber = null

        //TODO compare oldFiber to element
        //Here React alse uses keys 
        const sameType = 
            oldFiber && 
            element &&
            element.type == oldFiber.type
        if (sameType) {
            //TODO update the node
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: "UPDATE"
            }
        }
        if (element && !sameType) {
            //TODO add this node
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: "PLACEMENT"
            }
        }
        if (oldFiber && !sameType) {
            //TODO delete the oldFiber's node
            oldFiber.effectTag = "DELETION"
            deletions.push(oldFiber)
        }

        if (index === 0) {
            wipFiber.child = newFiber 
        } else if (element) {
            prevSibling.sibling = newFiber
        }

        prevSibling = newFiber
        index++
    }
}
  
const MiniReact = {
    createElement,
    render,
    useState
}
  
/** @jsx MiniReact.createElement */
function Counter() {
    const [state, setState] = MiniReact.useState(1)
    console.log("ss:", state, setState)
    return (
        <h1 onclick={() => setState((c) => c+1)} style="user-select: none">
            Count: {state}
        </h1>
    )
}

const element = <Counter />
// const element = MiniReact.createElement(
//     "div",
//     { id: "foo" },
//     MiniReact.createElement("a", null, "bar"),
//     MiniReact.createElement("b") 
// )
const container = document.getElementById("root")
MiniReact.render(element, container)