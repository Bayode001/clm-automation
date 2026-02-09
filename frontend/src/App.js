import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';
import ContractList from './components/ContractList';
import ContractDetail from './components/ContractDetail';
import ContractUpload from './components/ContractUpload';

function App() {
    return (
        <Router>
            <div className="App">
                <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
                    <div className="container">
                        <a className="navbar-brand" href="/">
                            📄 CLM Automation
                        </a>
                    </div>
                </nav>
                
                <div className="container mt-4">
                    <Routes>
                        <Route path="/" element={
                            <div className="row">
                                <div className="col-lg-8">
                                    <ContractList />
                                </div>
                                <div className="col-lg-4">
                                    <ContractUpload />
                                </div>
                            </div>
                        } />
                        <Route path="/contract/:id" element={<ContractDetail />} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App;
