import React from 'react';
import ReactDOM from 'react-dom';
import CSSTransition from 'react-transition-group/CSSTransition';
import "./Toast.css";

const config = {
  displayTime: 4000,
  fadeTime: 800
};

class ToastItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      show: false
    };
    queueMicrotask(() => {
      this.setState({ show: true });
    });
  }

  render() {
    return (
      <CSSTransition
        in={this.state.show && this.props.show}
        classNames="toast"
        timeout={config.fadeTime}
        onExited={this.props.onFadeOut}
        unmountOnExit>
        <div className="toast-item">
          {this.props.message}
        </div>
      </CSSTransition>
    );
  }
}

class ToastContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      toasts: []
    };
    this.timeouts = new Set();
    props.triggerRef(this);
  }

  componentWillUnmount() {
    this.timeouts.forEach(id => clearTimeout(id));
  }

  createTimeout(callback, elapse) {
    let id = setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, elapse);
    this.timeouts.add(id);
    return id;
  }

  generateToastId() {
    const charset = '0123456789abcdefghijklmnopqrstuvwxyz';
    return [
      Date.now(),
      new Array(8).fill(0).map(() => charset[Math.floor(Math.random() * charset.length)]).join('')
    ].join('-');
  }

  push(message) {
    let toast = {
      id: this.generateToastId(),
      message, show: true
    };
    this.setState(state => {
      return { toasts: state.toasts.concat(toast) };
    });
    this.createTimeout(() => {
      toast.show = false;
      this.setState({ toasts: this.state.toasts });
    }, config.displayTime);
  }

  remove(id) {
    this.setState(state => {
      return {
        toasts: state.toasts.filter(toast => toast.id !== id)
      };
    });
  }

  render() {
    const toastItems = this.state.toasts.map(toast => (
      <ToastItem
        key={toast.id}
        message={toast.message}
        show={toast.show}
        onFadeOut={() => this.remove(toast.id)}
      />
    ));

    return (
      <div className="toast-container">
        {toastItems}
      </div>
    );
  }
}

export default (() => {
  const dom = document.createElement('div');
  document.body.appendChild(dom);

  let container;

  ReactDOM.render(
    <ToastContainer
      triggerRef={ref => container = ref}
    />, dom);

  return function (message) {
    container.push(message);
  };
})();
