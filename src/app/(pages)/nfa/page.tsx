"use client"

import React, { useState } from 'react'
import { Plus, Trash2, Sun, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

type NFATransition = {
    currentState: string
    inputSymbol: string
    nextStates: string
}

type SimulationStep = {
    step: number
    currentStates: string[]
    inputSymbol: string
    nextStates: string[]
}

type SimulationResult = {
    accepted: boolean
    steps: SimulationStep[]
    message: string
    finalStatesReached: string[]
}

type DiagramTransition = {
    from: string
    to: string
    label: string
    isLoop: boolean
    curveDirection: number
}

type DiagramSnapshot = {
    states: string[]
    startState: string
    finalStates: string[]
    transitions: DiagramTransition[]
}

const EPSILON = 'ε'

const parseCommaSeparatedValues = (value: string) =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

const normalizeSymbol = (symbol: string) => {
    const normalized = symbol.trim()
    return normalized.toLowerCase() === 'e' ? EPSILON : normalized
}

const uniqueSorted = (values: string[]) => Array.from(new Set(values)).sort()

const formatStates = (values: string[]) => values.join(', ') || '-'

const getDiagramLabelStyle = (label: string) => ({
    letterSpacing: label.length > 2 ? '0.04em' : '0.02em',
    wordSpacing: label.includes(' ') || label.includes(',') ? '0.35em' : '0em',
})

const groupDiagramTransitions = (transitions: DiagramTransition[]) => {
    const grouped = new Map<string, DiagramTransition & { labels: string[] }>()

    transitions.forEach((transition) => {
        const key = `${transition.from}::${transition.to}::${transition.isLoop ? 'loop' : 'edge'}`
        const existing = grouped.get(key)

        if (existing) {
            existing.labels.push(transition.label)
            return
        }

        grouped.set(key, { ...transition, labels: [transition.label] })
    })

    return Array.from(grouped.values()).map(({ labels, ...transition }) => ({
        ...transition,
        label: Array.from(new Set(labels)).join(', '),
    }))
}

const getNFATransitionCell = (
    transitions: NFATransition[],
    currentState: string,
    inputSymbol: string
) => {
    const matched = transitions.filter(
        (transition) =>
            transition.currentState === currentState &&
            normalizeSymbol(transition.inputSymbol) === normalizeSymbol(inputSymbol)
    )

    if (!matched.length) {
        return '—'
    }

    const nextStates = matched.flatMap((transition) => parseCommaSeparatedValues(transition.nextStates))
    return uniqueSorted(nextStates).join(', ') || '—'
}

const buildTransitionMap = (transitionList: NFATransition[]) => {
    const transitionMap = new Map<string, string[]>()

    transitionList.forEach((transition) => {
        const currentState = transition.currentState.trim()
        const inputSymbol = normalizeSymbol(transition.inputSymbol)
        const nextStates = parseCommaSeparatedValues(transition.nextStates)

        if (!currentState || !inputSymbol || !nextStates.length) {
            return
        }

        const key = `${currentState}::${inputSymbol}`
        const existing = transitionMap.get(key) ?? []
        transitionMap.set(key, uniqueSorted([...existing, ...nextStates]))
    })

    return transitionMap
}

const epsilonClosure = (states: string[], transitionMap: Map<string, string[]>) => {
    const visited = new Set(states)
    const stack = [...states]

    while (stack.length > 0) {
        const current = stack.pop()
        if (!current) {
            continue
        }

        const epsilonTargets = transitionMap.get(`${current}::${EPSILON}`) ?? []
        epsilonTargets.forEach((target) => {
            if (!visited.has(target)) {
                visited.add(target)
                stack.push(target)
            }
        })
    }

    return uniqueSorted(Array.from(visited))
}

const runNFASimulation = (
    input: string,
    start: string,
    finals: string,
    transitionList: NFATransition[]
): SimulationResult => {
    const transitionMap = buildTransitionMap(transitionList)
    const finalStatesSet = new Set(parseCommaSeparatedValues(finals))
    let currentStates = epsilonClosure([start], transitionMap)
    const steps: SimulationStep[] = []

    for (let i = 0; i < input.length; i++) {
        const symbol = input[i]
        const nextStateCandidates = currentStates.flatMap(
            (state) => transitionMap.get(`${state}::${symbol}`) ?? []
        )
        const nextStates = epsilonClosure(uniqueSorted(nextStateCandidates), transitionMap)

        steps.push({
            step: i + 1,
            currentStates,
            inputSymbol: symbol,
            nextStates,
        })

        if (!nextStates.length) {
            return {
                accepted: false,
                steps,
                message: `Rejected: No transition found for symbol '${symbol}' from active states {${formatStates(currentStates)}}.`,
                finalStatesReached: [],
            }
        }

        currentStates = nextStates
    }

    const reachedFinalStates = currentStates.filter((state) => finalStatesSet.has(state))
    const accepted = reachedFinalStates.length > 0

    return {
        accepted,
        steps,
        message: accepted
            ? `Accepted! Final active states include ${formatStates(reachedFinalStates)}.`
            : `Rejected: Final active states ${formatStates(currentStates)} do not contain any final state.`,
        finalStatesReached: currentStates,
    }
}

export default function NFA() {
    const [states, setStates] = useState('q0,q1,q2')
    const [alphabet, setAlphabet] = useState(`a,b,${EPSILON}`)
    const [startState, setStartState] = useState('q0')
    const [finalStates, setFinalStates] = useState('q2')
    const [inputString, setInputString] = useState('')
    const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
    const [diagramSnapshot, setDiagramSnapshot] = useState<DiagramSnapshot | null>(null)

    const [transitions, setTransitions] = useState<NFATransition[]>([
        { currentState: 'q0', inputSymbol: 'a', nextStates: 'q0,q1' },
        { currentState: 'q0', inputSymbol: 'b', nextStates: 'q0' },
        { currentState: 'q1', inputSymbol: EPSILON, nextStates: 'q2' },
        { currentState: 'q1', inputSymbol: 'b', nextStates: 'q1' },
    ])

    const handleAddTransition = () => {
        setTransitions([
            ...transitions,
            { currentState: 'q0', inputSymbol: 'a', nextStates: 'q0' },
        ])
    }

    const handleRemoveTransition = (index: number) => {
        setTransitions(transitions.filter((_, currentIndex) => currentIndex !== index))
    }

    const handleTransitionChange = (
        index: number,
        field: keyof NFATransition,
        value: string
    ) => {
        const updated = [...transitions]
        updated[index][field] = value
        setTransitions(updated)
    }

    const handleGenerateDiagram = () => {
        const parsedStates = parseCommaSeparatedValues(states)
        const parsedFinalStates = parseCommaSeparatedValues(finalStates)
        const curveUsage = new Map<string, number>()

        const normalizedTransitions = transitions.flatMap((transition) => {
            const currentState = transition.currentState.trim()
            const label = normalizeSymbol(transition.inputSymbol)
            const nextStates = parseCommaSeparatedValues(transition.nextStates)

            if (!currentState || !label || nextStates.length === 0) {
                return []
            }

            return nextStates.map((nextState) => {
                const pairKey = `${currentState}->${nextState}`
                const reverseKey = `${nextState}->${currentState}`
                const currentCount = curveUsage.get(reverseKey) ?? 0
                curveUsage.set(pairKey, currentCount + 1)

                return {
                    from: currentState,
                    to: nextState,
                    label,
                    isLoop: currentState === nextState,
                    curveDirection: currentState === nextState ? 0 : currentCount % 2 === 0 ? 1 : -1,
                }
            })
        })

        setDiagramSnapshot({
            states: parsedStates,
            startState,
            finalStates: parsedFinalStates,
            transitions: groupDiagramTransitions(normalizedTransitions),
        })
    }

    const activeDiagram = diagramSnapshot ?? {
        states: parseCommaSeparatedValues(states),
        startState,
        finalStates: parseCommaSeparatedValues(finalStates),
        transitions: groupDiagramTransitions(transitions.flatMap((transition) =>
            parseCommaSeparatedValues(transition.nextStates).map((nextState) => ({
                from: transition.currentState,
                to: nextState,
                label: normalizeSymbol(transition.inputSymbol),
                isLoop: transition.currentState === nextState,
                curveDirection: 1,
            }))
        )),
    }

    const diagramStates = activeDiagram.states
    const svgWidth = Math.max(520, diagramStates.length * 170)
    const svgHeight = 260
    const radius = 26
    const horizontalGap = diagramStates.length > 1 ? (svgWidth - 180) / (diagramStates.length - 1) : 0
    const statePositions = new Map(
        diagramStates.map((state, index) => [
            state,
            {
                x: diagramStates.length === 1 ? svgWidth / 2 : 90 + index * horizontalGap,
                y: 140,
            },
        ])
    )

    const handleRunSimulation = () => {
        const parsedStates = parseCommaSeparatedValues(states)
        const parsedAlphabet = parseCommaSeparatedValues(alphabet).map(normalizeSymbol)
        const finalStateValues = parseCommaSeparatedValues(finalStates)

        if (!startState.trim()) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: 'Rejected: Please select a start state.',
                finalStatesReached: [],
            })
            return
        }

        if (!parsedStates.includes(startState)) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: `Rejected: Start state '${startState}' is not listed in states.`,
                finalStatesReached: [],
            })
            return
        }

        const invalidFinalState = finalStateValues.find((state) => !parsedStates.includes(state))
        if (invalidFinalState) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: `Rejected: Final state '${invalidFinalState}' is not listed in states.`,
                finalStatesReached: [],
            })
            return
        }

        const invalidSymbol = inputString
            .split('')
            .find((symbol) => !parsedAlphabet.includes(normalizeSymbol(symbol)) || normalizeSymbol(symbol) === EPSILON)

        if (invalidSymbol) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: `Rejected: Symbol '${invalidSymbol}' is not part of the input alphabet.`,
                finalStatesReached: [],
            })
            return
        }

        setSimulationResult(
            runNFASimulation(inputString, startState, finalStates, transitions)
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans antialiased">
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded border-2 border-slate-900 text-xs font-bold">
                        Σ
                    </div>
                    <span className="text-sm font-semibold tracking-tight">Automata Visualizer</span>
                </div>

                <div className="flex items-center rounded-lg border border-slate-200/60 bg-slate-100 p-1">
                    <Link href="/dfa" className="rounded-md px-4 py-1 text-xs font-medium text-slate-600 transition-all hover:text-slate-900">
                        DFA
                    </Link>
                    <Link href="/nfa" className="rounded-md bg-slate-900 px-4 py-1 text-xs font-medium text-white shadow-sm transition-all">
                        NFA
                    </Link>
                </div>

                <Button variant="ghost" size="icon" className="rounded-full">
                    <Sun className="h-4 w-4 text-slate-500" />
                </Button>
            </header>

            <main className="mx-auto max-w-7xl space-y-6 p-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                        Nondeterministic Finite Automaton (NFA)
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                        Create your NFA by defining states, alphabet including epsilon transitions, start state, final states, and one-to-many transitions.
                    </p>
                </div>

                <div className="">
                    <div className="space-y-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>1. Basic Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-700">States</label>
                                    <Input value={states} onChange={(e) => setStates(e.target.value)} />
                                    <span className="mt-1 block text-[10px] text-slate-400">
                                        Enter states separated by comma (e.g., q0,q1,q2)
                                    </span>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-700">Alphabet</label>
                                    <Input value={alphabet} onChange={(e) => setAlphabet(e.target.value)} />
                                    <span className="mt-1 block text-[10px] text-slate-400">
                                        Enter alphabet symbols separated by comma (use ε or e for epsilon)
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-slate-700">Start State</label>
                                        <Select value={startState} onValueChange={setStartState}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {parseCommaSeparatedValues(states).map((stateValue) => (
                                                    <SelectItem key={stateValue} value={stateValue}>
                                                        {stateValue}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-slate-700">Final States</label>
                                        <Input value={finalStates} onChange={(e) => setFinalStates(e.target.value)} />
                                        <span className="mt-1 block text-[10px] text-slate-400">
                                            Enter final states separated by comma (e.g., q2)
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <CardTitle>2. Transitions</CardTitle>
                                <Button onClick={handleAddTransition} size="sm" className="h-8 gap-1">
                                    <Plus className="h-3.5 w-3.5" />
                                    Add Transition
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[25%]">Current State</TableHead>
                                            <TableHead className="w-[25%]">Input Symbol</TableHead>
                                            <TableHead className="w-[40%]">Next States</TableHead>
                                            <TableHead className="w-[10%] text-center">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transitions.map((transition, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    <Select
                                                        value={transition.currentState}
                                                        onValueChange={(value) => handleTransitionChange(index, 'currentState', value)}
                                                    >
                                                        <SelectTrigger className="h-8 w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {parseCommaSeparatedValues(states).map((stateValue) => (
                                                                <SelectItem key={stateValue} value={stateValue}>
                                                                    {stateValue}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={normalizeSymbol(transition.inputSymbol)}
                                                        onValueChange={(value) => handleTransitionChange(index, 'inputSymbol', value)}
                                                    >
                                                        <SelectTrigger className="h-8 w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {parseCommaSeparatedValues(alphabet).map((alphabetValue) => {
                                                                const normalizedValue = normalizeSymbol(alphabetValue)
                                                                return (
                                                                    <SelectItem key={normalizedValue} value={normalizedValue}>
                                                                        {normalizedValue}
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={transition.nextStates}
                                                        className="h-8"
                                                        placeholder="e.g., q0,q1"
                                                        onChange={(e) => handleTransitionChange(index, 'nextStates', e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveTransition(index)}
                                                        className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle>3. NFA Visualization</CardTitle>
                                    <Button onClick={handleGenerateDiagram} size="sm" variant="outline">
                                        Generate Diagram
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="min-h-[260px] w-full overflow-x-auto rounded-lg border border-slate-100 bg-white p-4">
                                    <svg
                                        className="h-auto w-full overflow-visible"
                                        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                                    >
                                        <defs>
                                            <marker id="arrow" viewBox="0 0 10 10" refX="14" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
                                            </marker>
                                        </defs>

                                        {diagramStates.length > 0 && statePositions.has(activeDiagram.startState) ? (
                                            <>
                                                <text
                                                    x={(statePositions.get(activeDiagram.startState)?.x ?? 90) - 52}
                                                    y={145}
                                                    className="fill-slate-800 text-[11px] font-medium"
                                                    textAnchor="middle"
                                                >
                                                    Start
                                                </text>
                                                <line
                                                    x1={(statePositions.get(activeDiagram.startState)?.x ?? 90) - 42}
                                                    y1={140}
                                                    x2={(statePositions.get(activeDiagram.startState)?.x ?? 90) - radius}
                                                    y2={140}
                                                    stroke="#1e293b"
                                                    strokeWidth="1.5"
                                                    markerEnd="url(#arrow)"
                                                />
                                            </>
                                        ) : null}

                                        {activeDiagram.transitions.map((transition, index) => {
                                            const from = statePositions.get(transition.from)
                                            const to = statePositions.get(transition.to)

                                            if (!from || !to) {
                                                return null
                                            }

                                            if (transition.isLoop) {
                                                return (
                                                    <g key={`${transition.from}-${transition.label}-${index}`}>
                                                        <path
                                                            d={`M ${from.x - 12} ${from.y - 22} C ${from.x - 34} ${from.y - 82}, ${from.x + 34} ${from.y - 82}, ${from.x + 12} ${from.y - 22}`}
                                                            fill="none"
                                                            stroke="#1e293b"
                                                            strokeWidth="1.5"
                                                            markerEnd="url(#arrow)"
                                                        />
                                                        <text
                                                            x={from.x}
                                                            y={from.y - 92}
                                                            className="fill-slate-800 text-[11px] font-medium"
                                                            textAnchor="middle"
                                                            style={getDiagramLabelStyle(transition.label)}
                                                        >
                                                            {transition.label}
                                                        </text>
                                                    </g>
                                                )
                                            }

                                            const isForward = to.x >= from.x
                                            const startX = from.x + (isForward ? radius : -radius)
                                            const endX = to.x + (isForward ? -radius : radius)
                                            const midX = (startX + endX) / 2
                                            const controlY = from.y - 40 * transition.curveDirection
                                            const labelY = controlY - 8 * transition.curveDirection

                                            return (
                                                <g key={`${transition.from}-${transition.to}-${transition.label}-${index}`}>
                                                    <path
                                                        d={`M ${startX} ${from.y} Q ${midX} ${controlY} ${endX} ${to.y}`}
                                                        fill="none"
                                                        stroke="#1e293b"
                                                        strokeWidth="1.5"
                                                        markerEnd="url(#arrow)"
                                                    />
                                                    <text
                                                        x={midX}
                                                        y={labelY}
                                                        className="fill-slate-800 text-[11px] font-medium"
                                                        textAnchor="middle"
                                                        style={getDiagramLabelStyle(transition.label)}
                                                    >
                                                        {transition.label}
                                                    </text>
                                                </g>
                                            )
                                        })}

                                        {diagramStates.map((state) => {
                                            const position = statePositions.get(state)

                                            if (!position) {
                                                return null
                                            }

                                            const isFinal = activeDiagram.finalStates.includes(state)

                                            return (
                                                <g key={state}>
                                                    <circle
                                                        cx={position.x}
                                                        cy={position.y}
                                                        r={radius}
                                                        fill="white"
                                                        stroke="#1e293b"
                                                        strokeWidth="1.5"
                                                    />
                                                    {isFinal ? (
                                                        <circle
                                                            cx={position.x}
                                                            cy={position.y}
                                                            r={radius - 5}
                                                            fill="none"
                                                            stroke="#1e293b"
                                                            strokeWidth="1.5"
                                                        />
                                                    ) : null}
                                                    <text
                                                        x={position.x}
                                                        y={position.y + 4}
                                                        className="fill-slate-900 text-[12px] font-medium"
                                                        textAnchor="middle"
                                                        style={getDiagramLabelStyle(state)}
                                                    >
                                                        {state}
                                                    </text>
                                                </g>
                                            )
                                        })}
                                    </svg>
                                </div>
                                <p className="mt-3 text-[11px] text-slate-500">
                                    Update your states and transitions, then click `Generate Diagram` to refresh the NFA graph.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>4. Transition Table</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[20%]">State</TableHead>
                                                {parseCommaSeparatedValues(alphabet).map((symbol) => (
                                                    <TableHead key={symbol} className="w-[20%] text-center">
                                                        {symbol}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parseCommaSeparatedValues(states).map((state) => (
                                                <TableRow key={state}>
                                                    <TableCell className="font-medium">{state}</TableCell>
                                                    {parseCommaSeparatedValues(alphabet).map((symbol) => (
                                                        <TableCell key={`${state}-${symbol}`} className="text-center">
                                                            {getNFATransitionCell(transitions, state, symbol)}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <p className="mt-3 text-[11px] text-slate-500">
                                    This table shows the NFA transition relation for every state and input symbol, including epsilon transitions.
                                </p>
                            </CardContent>
                        </Card>



                        <Card>
                            <CardHeader>
                                <CardTitle>5. Test Input String</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-700">Input String</label>
                                    <Input
                                        placeholder="e.g., aababb"
                                        value={inputString}
                                        onChange={(e) => setInputString(e.target.value)}
                                    />
                                </div>

                                <Button onClick={handleRunSimulation} className="h-9 px-4">
                                    Run Simulation
                                </Button>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-medium text-slate-700">Result</label>
                                    <div
                                        className={`w-full rounded-md border p-3 text-xs ${simulationResult
                                                ? simulationResult.accepted
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                    : 'border-red-200 bg-red-50 text-red-700'
                                                : 'border-slate-200 bg-slate-50 text-slate-400'
                                            }`}
                                    >
                                        {simulationResult?.message ?? 'Result will appear here...'}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <Card className="w-full">
                    <CardHeader>
                        <CardTitle>6. Simulation Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {simulationResult ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Start Closure</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {simulationResult.steps[0]
                                            ? formatStates(simulationResult.steps[0].currentStates)
                                            : formatStates(
                                                epsilonClosure(
                                                    [startState],
                                                    buildTransitionMap(transitions)
                                                )
                                            )}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Final Active States</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">
                                        {formatStates(simulationResult.finalStatesReached)}
                                    </p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Status</p>
                                    <p className={`mt-1 text-sm font-semibold ${simulationResult.accepted ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {simulationResult.accepted ? 'Accepted' : 'Rejected'}
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[12%]">Step</TableHead>
                                    <TableHead className="w-[22%]">Current Active States</TableHead>
                                    <TableHead className="w-[16%]">Input Symbol</TableHead>
                                    <TableHead className="w-[22%]">Next Active States</TableHead>
                                    <TableHead className="w-[18%]">Remaining Input</TableHead>
                                    <TableHead className="w-[10%]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            {simulationResult?.steps.length ? (
                                <TableBody>
                                    <TableRow>
                                        <TableCell>0</TableCell>
                                        <TableCell>
                                            {formatStates(
                                                epsilonClosure(
                                                    [startState],
                                                    buildTransitionMap(transitions)
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>
                                            {formatStates(
                                                epsilonClosure(
                                                    [startState],
                                                    buildTransitionMap(transitions)
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell>{inputString || 'epsilon'}</TableCell>
                                        <TableCell>Start</TableCell>
                                    </TableRow>
                                    {simulationResult.steps.map((step) => (
                                        <TableRow key={`${step.step}-${step.inputSymbol}-${step.currentStates.join('-')}`}>
                                            <TableCell>{step.step}</TableCell>
                                            <TableCell>{formatStates(step.currentStates)}</TableCell>
                                            <TableCell>{step.inputSymbol}</TableCell>
                                            <TableCell>{formatStates(step.nextStates)}</TableCell>
                                            <TableCell>{inputString.slice(step.step) || 'epsilon'}</TableCell>
                                            <TableCell>
                                                {step.nextStates.length === 0
                                                    ? 'Rejected'
                                                    : step.step === simulationResult.steps.length
                                                        ? simulationResult.accepted
                                                            ? 'Accepted'
                                                            : 'Processed'
                                                        : 'Processed'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            ) : null}
                        </Table>

                        {!simulationResult?.steps.length ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                                <ClipboardList className="h-5 w-5 text-slate-300" />
                                <span className="text-xs">Run simulation to see the steps...</span>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
