"use client"
import React, { useState } from 'react'
import { Plus, Trash2, Sun, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

type DFATransition = {
    currentState: string
    inputSymbol: string
    nextState: string
}

type SimulationStep = {
    step: number
    currentState: string
    inputSymbol: string
    nextState: string
}

type SimulationResult = {
    accepted: boolean
    steps: SimulationStep[]
    message: string
    finalState: string
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

const parseCommaSeparatedValues = (value: string) =>
    value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

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

const runDFASimulation = (
    input: string,
    start: string,
    finals: string,
    transitionList: DFATransition[]
): SimulationResult => {
    let currentState = start
    const steps: SimulationStep[] = []
    const finalStatesSet = new Set(parseCommaSeparatedValues(finals))

    for (let i = 0; i < input.length; i++) {
        const symbol = input[i]
        const match = transitionList.find(
            (transition) =>
                transition.currentState === currentState &&
                transition.inputSymbol === symbol
        )

        if (!match) {
            return {
                accepted: false,
                steps: [
                    ...steps,
                    {
                        step: i + 1,
                        currentState,
                        inputSymbol: symbol,
                        nextState: 'REJECT/DEAD',
                    },
                ],
                message: `Rejected: No transition defined from ${currentState} with symbol '${symbol}'.`,
                finalState: 'REJECT/DEAD',
            }
        }

        steps.push({
            step: i + 1,
            currentState,
            inputSymbol: symbol,
            nextState: match.nextState,
        })

        currentState = match.nextState
    }

    const isAccepted = finalStatesSet.has(currentState)

    return {
        accepted: isAccepted,
        steps,
        message: isAccepted
            ? `Accepted! Ended in final state: ${currentState}`
            : `Rejected: Ended in non-final state: ${currentState}`,
        finalState: currentState,
    }
}

export default function DFA() {
    const [states, setStates] = useState('q0,q1,q2')
    const [alphabet, setAlphabet] = useState('a,b')
    const [startState, setStartState] = useState('q0')
    const [finalStates, setFinalStates] = useState('q2')
    const [inputString, setInputString] = useState('')
    const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)
    const [diagramSnapshot, setDiagramSnapshot] = useState<DiagramSnapshot | null>(null)

    const [transitions, setTransitions] = useState<DFATransition[]>([
        { currentState: 'q0', inputSymbol: 'a', nextState: 'q1' },
        { currentState: 'q0', inputSymbol: 'b', nextState: 'q0' },
        { currentState: 'q1', inputSymbol: 'a', nextState: 'q2' },
        { currentState: 'q1', inputSymbol: 'b', nextState: 'q0' },
    ])

    const handleAddTransition = () => {
        setTransitions([
            ...transitions,
            { currentState: 'q0', inputSymbol: 'a', nextState: 'q0' },
        ])
    }

    const handleRemoveTransition = (index: number) => {
        setTransitions(transitions.filter((_, i) => i !== index))
    }

    const handleTransitionChange = (
        index: number,
        field: keyof DFATransition,
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

        const normalizedTransitions = transitions
            .filter(
                (transition) =>
                    transition.currentState.trim() &&
                    transition.inputSymbol.trim() &&
                    transition.nextState.trim()
            )
            .map((transition) => {
                const pairKey = `${transition.currentState}->${transition.nextState}`
                const reverseKey = `${transition.nextState}->${transition.currentState}`
                const currentCount = curveUsage.get(reverseKey) ?? 0
                curveUsage.set(pairKey, currentCount + 1)

                return {
                    from: transition.currentState,
                    to: transition.nextState,
                    label: transition.inputSymbol,
                    isLoop: transition.currentState === transition.nextState,
                    curveDirection: transition.currentState === transition.nextState ? 0 : currentCount % 2 === 0 ? 1 : -1,
                }
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
        transitions: groupDiagramTransitions(transitions.map((transition) => ({
            from: transition.currentState,
            to: transition.nextState,
            label: transition.inputSymbol,
            isLoop: transition.currentState === transition.nextState,
            curveDirection: 1,
        }))),
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
        const parsedAlphabet = parseCommaSeparatedValues(alphabet)
        const finalStateValues = parseCommaSeparatedValues(finalStates)

        if (!startState.trim()) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: 'Rejected: Please select a start state.',
                finalState: '',
            })
            return
        }

        if (!parsedStates.includes(startState)) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: `Rejected: Start state '${startState}' is not listed in states.`,
                finalState: '',
            })
            return
        }

        const invalidFinalState = finalStateValues.find((state) => !parsedStates.includes(state))
        if (invalidFinalState) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: `Rejected: Final state '${invalidFinalState}' is not listed in states.`,
                finalState: '',
            })
            return
        }

        const invalidSymbol = inputString.split('').find((symbol) => !parsedAlphabet.includes(symbol))
        if (invalidSymbol) {
            setSimulationResult({
                accepted: false,
                steps: [],
                message: `Rejected: Symbol '${invalidSymbol}' is not part of the alphabet.`,
                finalState: '',
            })
            return
        }

        setSimulationResult(
            runDFASimulation(inputString, startState, finalStates, transitions)
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans antialiased">
            <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-slate-900 rounded flex items-center justify-center font-bold text-xs">
                        ∑
                    </div>
                    <span className="font-semibold text-sm tracking-tight">Automata Visualizer</span>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60">
                    <Link href={"/dfa"} className="px-4 py-1 text-xs font-medium rounded-md bg-slate-900 text-white shadow-sm transition-all">
                        DFA
                    </Link>
                    <Link href={"/nfa"} className="px-4 py-1 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 transition-all">
                        NFA
                    </Link>
                </div>

                <Button variant="ghost" size="icon" className="rounded-full">
                    <Sun className="w-4 h-4 text-slate-500" />
                </Button>
            </header>

            <main className="max-w-7xl mx-auto p-6 space-y-6">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                        Deterministic Finite Automaton (DFA)
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Create your DFA by defining states, alphabet, transitions, start state and final states. Test input strings and visualize the automaton.
                    </p>
                </div>

                <div className="">
                    <div className="space-y-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        <Card>
                            <CardHeader>
                                <CardTitle>1. Basic Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1.5">States</label>
                                    <Input value={states} onChange={(e) => setStates(e.target.value)} />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Enter states separated by comma (e.g., q0,q1,q2)
                                    </span>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Alphabet</label>
                                    <Input value={alphabet} onChange={(e) => setAlphabet(e.target.value)} />
                                    <span className="text-[10px] text-slate-400 mt-1 block">
                                        Enter alphabet symbols separated by comma (e.g., a,b)
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Start State</label>
                                        <Select value={startState} onValueChange={setStartState}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {parseCommaSeparatedValues(states).map((stateVal) => {
                                                    return (
                                                        <SelectItem key={stateVal} value={stateVal}>
                                                            {stateVal}
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-700 mb-1.5">Final States</label>
                                        <Input value={finalStates} onChange={(e) => setFinalStates(e.target.value)} />
                                        <span className="text-[10px] text-slate-400 mt-1 block">
                                            Enter final states separated by comma (e.g., q2)
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                <CardTitle>2. Transitions</CardTitle>
                                <Button onClick={handleAddTransition} size="sm" className="gap-1 h-8">
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Transition
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Current State</TableHead>
                                            <TableHead className="w-[30%]">Input Symbol</TableHead>
                                            <TableHead className="w-[30%]">Next State</TableHead>
                                            <TableHead className="text-center w-[10%]">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transitions.map((t, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <Select
                                                        value={t.currentState}
                                                        onValueChange={(val) => handleTransitionChange(idx, 'currentState', val)}
                                                    >
                                                        <SelectTrigger className="w-full h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {parseCommaSeparatedValues(states).map((stateVal) => {
                                                                return (
                                                                    <SelectItem key={stateVal} value={stateVal}>
                                                                        {stateVal}
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={t.inputSymbol}
                                                        onValueChange={(val) => handleTransitionChange(idx, 'inputSymbol', val)}
                                                    >
                                                        <SelectTrigger className="w-full h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {parseCommaSeparatedValues(alphabet).map((alphaVal) => {
                                                                return (
                                                                    <SelectItem key={alphaVal} value={alphaVal}>
                                                                        {alphaVal}
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={t.nextState}
                                                        onValueChange={(val) => handleTransitionChange(idx, 'nextState', val)}
                                                    >
                                                        <SelectTrigger className="w-full h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {parseCommaSeparatedValues(states).map((stateVal) => {
                                                                return (
                                                                    <SelectItem key={stateVal} value={stateVal}>
                                                                        {stateVal}
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveTransition(idx)}
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
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
                                    <CardTitle>3. DFA Visualization</CardTitle>
                                    <Button onClick={handleGenerateDiagram} size="sm" variant="outline">
                                        Generate Diagram
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="w-full border border-slate-100 rounded-lg bg-white p-4 min-h-[260px] overflow-x-auto">
                                    <svg
                                        className="w-full h-auto overflow-visible"
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
                                                    className="text-[11px] font-medium fill-slate-800"
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
                                                            className="text-[11px] font-medium fill-slate-800"
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
                                                        className="text-[11px] font-medium fill-slate-800"
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
                                                        className="text-[12px] font-medium fill-slate-900"
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
                                    Update your states and transitions, then click `Generate Diagram` to refresh the DFA graph.
                                </p>
                            </CardContent>
                        </Card>




                        <Card>
                            <CardHeader>
                                <CardTitle>4. Test Input String</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Input String</label>
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
                                        className={`w-full p-3 rounded-md border text-xs ${simulationResult
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
                        <CardTitle>5. Simulation Steps</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {simulationResult ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Start State</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{startState || '-'}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Final State</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{simulationResult.finalState || '-'}</p>
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
                                    <TableHead className="w-[20%]">Current State</TableHead>
                                    <TableHead className="w-[18%]">Input Symbol</TableHead>
                                    <TableHead className="w-[20%]">Next State</TableHead>
                                    <TableHead className="w-[20%]">Remaining Input</TableHead>
                                    <TableHead className="w-[10%]">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            {simulationResult?.steps.length ? (
                                <TableBody>
                                    <TableRow>
                                        <TableCell>0</TableCell>
                                        <TableCell>{startState}</TableCell>
                                        <TableCell>-</TableCell>
                                        <TableCell>{startState}</TableCell>
                                        <TableCell>{inputString || 'epsilon'}</TableCell>
                                        <TableCell>Start</TableCell>
                                    </TableRow>
                                    {simulationResult.steps.map((step) => (
                                        <TableRow key={`${step.step}-${step.currentState}-${step.inputSymbol}`}>
                                            <TableCell>{step.step}</TableCell>
                                            <TableCell>{step.currentState}</TableCell>
                                            <TableCell>{step.inputSymbol}</TableCell>
                                            <TableCell>{step.nextState}</TableCell>
                                            <TableCell>
                                                {inputString.slice(step.step) || 'epsilon'}
                                            </TableCell>
                                            <TableCell>
                                                {step.nextState === 'REJECT/DEAD'
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
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                <ClipboardList className="w-5 h-5 text-slate-300" />
                                <span className="text-xs">Run simulation to see the steps...</span>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
